import {sql} from "drizzle-orm";
import {z} from "zod";
import {db} from "@/db";
import {citizen} from "@/db/schema";
import {getCitizenSession} from "./citizen-auth";
import {contactBaseKeys,externalContactValues,validateContactProfile,type ContactProfile} from "./modules/contact-profile";
type Session=NonNullable<Awaited<ReturnType<typeof getCitizenSession>>>;
type Current={id:string;title:string;revision:number;data:{values?:Record<string,string>};citizen_id:string};
export class CitizenContactError extends Error {constructor(message:string,public status=400){super(message);}}
export async function contactProfile(id:string){
 const result=await db.execute(sql`SELECT id,name,revision,active,definition FROM module_contact_profile WHERE id=${z.string().uuid().parse(id)}::uuid`);
 const profile=result.rows[0] as unknown as ContactProfile|undefined;
 if(!profile)throw new CitizenContactError("Perfil não encontrado.",404);return profile;
}
async function currentContact(session:Session){
 const ownership=await db.execute(sql`SELECT c.email FROM module_contact_account a JOIN citizen c ON c.id=a.citizen_id WHERE a.uid=${session.uid}`);
 if(ownership.rows[0]&&String(ownership.rows[0].email).toLowerCase()!==session.email)throw new CitizenContactError("A mudança de e-mail exige conciliação do cadastro pelo atendimento.",409);
 const result=await db.execute(sql`SELECT m.id,m.title,m.revision,m.data,c.id AS citizen_id FROM module_contact_account a JOIN citizen c ON c.id=a.citizen_id JOIN module_record m ON m.id=a.contact_id WHERE a.uid=${session.uid} AND lower(c.email)=${session.email}`);
 if(result.rows[0])return result.rows[0] as unknown as Current;
 // Existing explicit fiscal association can be claimed only with the same verified email.
 const legacy=await db.execute(sql`SELECT m.id,m.title,m.revision,m.data,c.id AS citizen_id FROM citizen c JOIN module_contact_legacy l ON l.citizen_id=c.id JOIN module_record m ON m.id=l.contact_id WHERE lower(c.email)=${session.email} AND NOT EXISTS(SELECT 1 FROM module_contact_account WHERE citizen_id=c.id AND uid<>${session.uid}) AND NOT EXISTS(SELECT 1 FROM module_citizen_alias WHERE source_id=c.id) AND (m.external_owner_uid IS NULL OR m.external_owner_uid=${session.uid})`);
 if(legacy.rows.length>1)throw new CitizenContactError("Cadastros legados exigem conciliação pelo atendimento.",409);
 return legacy.rows[0] as unknown as Current|undefined;
}
export async function externalContactDetail(session:Session){
 const row=await currentContact(session);
 const people=await db.execute(sql`SELECT id,name,cpf_cnpj,phone,cep,street,number,complement,district,city,state FROM citizen WHERE lower(email)=${session.email} AND NOT EXISTS(SELECT 1 FROM module_citizen_alias WHERE source_id=citizen.id) AND NOT EXISTS(SELECT 1 FROM module_contact_account WHERE citizen_id=citizen.id AND uid<>${session.uid})`);
 if(people.rows.length>1)throw new CitizenContactError("Cadastros legados exigem conciliação pelo atendimento.",409);
 const person=people.rows[0];
 const profileId=row?.data.values?.contactProfileId;const profile=profileId?await contactProfile(profileId):undefined;
 return {name:person?.name??row?.title??"",revision:row?.revision??0,profileId:profileId??"",identityLocked:!!person,
  values:profile?externalContactValues(profile,row!.data.values??{}):{tipo:"Pessoa física",cpfCnpj:person?.cpf_cnpj??"",email:session.email,phone:person?.phone??"",cep:person?.cep??""},
  address:person?Object.fromEntries(["street","number","complement","district","city","state"].map(k=>[k,person[k]??""])):{}};
}
export const externalContactInput=z.object({name:z.string().trim().min(3).max(200),profileId:z.string().uuid(),profileRevision:z.number().int().positive(),revision:z.number().int().min(0),values:z.record(z.string().max(5000)),address:z.object({street:z.string().max(300).optional(),number:z.string().max(20).optional(),complement:z.string().max(100).optional(),district:z.string().max(200).optional(),city:z.string().max(200).optional(),state:z.string().max(2).optional()}).default({})});
export async function saveExternalContact(input:unknown,session:Session){
 const p=externalContactInput.parse(input);const profile=await contactProfile(p.profileId);
 if(profile.revision!==p.profileRevision)throw new CitizenContactError("Perfil atualizado. Recarregue os campos.",409);
 const row=await currentContact(session);
 if((row?.revision??0)!==p.revision)throw new CitizenContactError("Cadastro atualizado. Recarregue antes de salvar.",409);
 const allowed=new Set<string>(["tipo",...contactBaseKeys,...profile.definition.fields.filter(f=>f.channel!=="INTERNO").map(f=>f.key)]);
 if(Object.keys(p.values).some(k=>!allowed.has(k)))throw new CitizenContactError("Campo não disponível ao cadastro externo.");
 if(p.values.email!==undefined&&p.values.email.toLowerCase()!==session.email)throw new CitizenContactError("O e-mail deve corresponder à conta confirmada.",403);
 const values={...p.values};
 if(profile.definition.base.find(f=>f.key==="endereco")?.enabled===false&&Object.keys(p.address).length)throw new CitizenContactError("Endereço desabilitado neste perfil.");
 if(profile.definition.base.find(f=>f.key==="email")?.enabled!==false)values.email=session.email;
 const people=await db.execute(sql`SELECT cpf_cnpj,email,phone,cep FROM citizen WHERE lower(email)=${session.email} AND NOT EXISTS(SELECT 1 FROM module_citizen_alias WHERE source_id=citizen.id)`);
 if(people.rows.length>1)throw new CitizenContactError("Cadastros legados exigem conciliação.",409);
 const person=people.rows[0];
 const previous=row?.data.values??(person?{cpfCnpj:String(person.cpf_cnpj??""),email:String(person.email),phone:String(person.phone??""),cep:String(person.cep??"")}:{});
 let validated:Record<string,string>;
 try{validated=validateContactProfile(profile,values.tipo??"",values,"EXTERNO",previous);}catch(e){throw new CitizenContactError((e as Error).message);}
 // No client-supplied UID, owner, sector or arbitrary JSON reaches the write function.
 const result=await db.execute(sql`SELECT modules_external_contact_save(${session.uid},${session.email},${profile.id}::uuid,${profile.revision},${p.revision},${p.name},${JSON.stringify(validated)}::jsonb,${JSON.stringify(p.address)}::jsonb) AS id`);
 return {saved:true,id:result.rows[0].id};
}
export async function registeredCitizenForRequest(session:Session,cpfCnpj:string){
 const result=await db.execute(sql`SELECT c.*,m.data AS contact_data,p.id AS profile_id,p.name AS profile_name,p.revision AS profile_revision,p.definition AS profile_definition FROM module_contact_account a JOIN citizen c ON c.id=a.citizen_id JOIN module_record m ON m.id=a.contact_id JOIN module_contact_profile p ON p.id=(m.data->'values'->>'contactProfileId')::uuid WHERE a.uid=${session.uid} AND lower(c.email)=${session.email} AND (${cpfCnpj}='' OR regexp_replace(c.cpf_cnpj,'[^0-9]','','g')=${cpfCnpj}) AND p.active`);
 const row=result.rows[0];if(!row)throw new CitizenContactError("Complete seu cadastro por perfil em Minha conta antes de protocolar.",409);
 const data=row.contact_data as {values:Record<string,string>};const profile:ContactProfile={id:String(row.profile_id),name:String(row.profile_name),revision:Number(row.profile_revision),active:true,definition:row.profile_definition as ContactProfile["definition"]};
 try{validateContactProfile(profile,data.values.tipo,{},"EXTERNO",data.values);}catch{throw new CitizenContactError("O perfil foi atualizado. Complete os campos obrigatórios em Meu cadastro.",409);}
 return {id:String(row.id),name:String(row.name),cpfCnpj:String(row.cpf_cnpj),email:String(row.email),phone:row.phone as string|null,cep:row.cep as string|null,street:row.street as string|null,number:row.number as string|null,complement:row.complement as string|null,district:row.district as string|null,city:row.city as string|null,state:row.state as string|null} satisfies typeof citizen.$inferSelect;
}
export function citizenContactFailure(error:unknown){
 if(error instanceof CitizenContactError)return Response.json({error:error.message},{status:error.status,headers:{"cache-control":"no-store"}});
 if(error instanceof z.ZodError)return Response.json({error:"Confira os campos obrigatórios e os formatos do cadastro."},{status:400});
 return Response.json({error:"Cadastro não salvo. Confira se houve atualização, divergência de identidade ou contato já existente; recarregue ou procure o atendimento."},{status:409,headers:{"cache-control":"no-store"}});
}
