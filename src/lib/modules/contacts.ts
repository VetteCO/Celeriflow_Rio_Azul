import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { moduleRecord } from "@/db/modules-schema";
import { admin, getRecord, ModuleError, scope, validateBusiness, type Context } from "./server";
import { canManage } from "./policy";
import {profileSchema,validateContactProfile as validateProfile,type ContactProfile} from "./contact-profile";
export {profileSchema,contactTypes,contactFieldSchema,type ContactProfile} from "./contact-profile";
export type ContactSegment={id:string;name:string;description:string;revision:number;department_id:string;members:string[]};
export async function profiles() {const r=await db.execute(sql`SELECT id,name,revision,active,definition FROM module_contact_profile ORDER BY name,id`);return r.rows as unknown as ContactProfile[];}
export async function saveProfile(input:unknown,ctx:Context,id?:string) {
 admin(ctx);const p=profileSchema.parse(input);const revision=z.object({revision:z.number().int().positive().optional()}).parse(input).revision;
 const result=id?await db.execute(sql`UPDATE module_contact_profile SET name=${p.name},active=${p.active},definition=${JSON.stringify(p.definition)}::jsonb,revision=revision+1,actor_id=${ctx.user.id}::uuid,updated_at=now() WHERE id=${z.string().uuid().parse(id)}::uuid AND revision=${revision??0} RETURNING id`):await db.execute(sql`INSERT INTO module_contact_profile(name,active,definition,actor_id) VALUES(${p.name},${p.active},${JSON.stringify(p.definition)}::jsonb,${ctx.user.id}::uuid) RETURNING id`);
 if(!result.rows.length)throw new ModuleError("Perfil atualizado. Recarregue.",409);return result.rows[0];
}
// Shared contract; pure implementation is also used by the external registration API.
export function validateContactProfile(profile:ContactProfile,type:string,values:Record<string,string>,channel:"INTERNO"|"EXTERNO",previous:Record<string,string>={}) {
 try{return validateProfile(profile,type,values,channel,previous);}catch(e){throw new ModuleError((e as Error).message);}
}
export async function listContacts(ctx:Context,filter:{segment?:string;profile?:string;type?:string}={}) {
 const rows=await db.select().from(moduleRecord).where(and(eq(moduleRecord.family,"contatos"),scope(ctx))).orderBy(desc(moduleRecord.updatedAt));
 let members:string[]|undefined;
 if(filter.segment){const segment=(await segments(ctx)).find(s=>s.id===filter.segment);if(!segment)throw new ModuleError("Lista não encontrada.",404);members=segment.members;}
 return rows.filter(r=>(!members||members.includes(r.id))&&(!filter.profile||r.data.values?.contactProfileId===filter.profile)&&(!filter.type||r.data.values?.tipo===filter.type)).map(r=>({id:r.id,title:r.title,code:r.code,status:r.status,revision:r.revision,values:r.data.values??{}}));
}
export async function saveContact(input:unknown,ctx:Context,id?:string) {
  const p=z.object({title:z.string().trim().min(3).max(250),profileId:z.string().uuid(),profileRevision:z.number().int().positive(),revision:z.number().int().positive().optional(),idempotencyKey:z.string().uuid().optional(),values:z.record(z.string(),z.string().max(5000))}).parse(input);
 const row=id?await getRecord(id,ctx):undefined;
 if(row&&(row.family!=="contatos"||!canManage(row,ctx)))throw new ModuleError("Contato não autorizado.",403);
 if(row?.status==="UNIFICADO")throw new ModuleError("Edite o cadastro principal.",409);
 const profile=(await profiles()).find(f=>f.id===p.profileId&&f.revision===p.profileRevision);
 if(!profile)throw new ModuleError("Perfil atualizado. Recarregue.",409);
 for(const key of ["cadastroPrincipal","citizenId","autorizador","delegacao","usos"])if(p.values[key]!==undefined&&p.values[key]!==row?.data.values?.[key])throw new ModuleError("Campo reservado.");
 const values=validateContactProfile(profile,p.values.tipo,p.values,"INTERNO",row?.data.values);
 validateBusiness("contatos",{values});
 const data={...row?.data,values};
 const fingerprint=createHash("sha256").update(JSON.stringify({title:p.title,profileId:p.profileId,values:Object.entries(values).sort()})).digest("hex");
 const result=await db.execute(sql`SELECT modules_contact_save(${id??null}::uuid,${p.revision??0},${ctx.user.id}::uuid,${ctx.user.departmentId??null}::uuid,${JSON.stringify(ctx.session.departmentIds)}::jsonb,${p.title},${JSON.stringify(data)}::jsonb,${p.profileId}::uuid,${p.profileRevision},${p.idempotencyKey??null}::uuid,${fingerprint}) AS id`);
 return {id:result.rows[0].id};
}
export async function segments(ctx:Context) {
 const r=await db.execute(sql`SELECT id,name,description,revision,department_id,members FROM module_contact_segment WHERE ${JSON.stringify(ctx.session.departmentIds)}::jsonb ? department_id::text ORDER BY name,id`);
 return r.rows as unknown as ContactSegment[];
}
export async function saveSegment(input:unknown,ctx:Context,id?:string) {
 const p=z.object({name:z.string().trim().min(2).max(100),description:z.string().max(2000).default(""),departmentId:z.string().uuid(),members:z.array(z.string().uuid()).max(10000),revision:z.number().int().positive().optional()}).parse(input);
 if(!ctx.session.departmentIds.includes(p.departmentId))throw new ModuleError("Setor fora do escopo.",403);
 for(const member of new Set(p.members)){const row=await getRecord(member,ctx);if(row.family!=="contatos"||row.status==="UNIFICADO")throw new ModuleError("Selecione somente contatos principais acessíveis.");}
 const result=await db.execute(sql`SELECT modules_contact_segment_save(${id??null}::uuid,${p.revision??0},${ctx.user.id}::uuid,${JSON.stringify(ctx.session.departmentIds)}::jsonb,${p.departmentId}::uuid,${p.name},${p.description},${JSON.stringify([...new Set(p.members)])}::jsonb) AS id`);
 return result.rows[0];
}
export async function mergeContacts(input:unknown,ctx:Context) {
 const p=z.object({sourceId:z.string().uuid(),targetId:z.string().uuid(),sourceRevision:z.number().int().positive(),targetRevision:z.number().int().positive()}).parse(input);
 for(const id of [p.sourceId,p.targetId]){const row=await getRecord(id,ctx);if(row.family!=="contatos"||!canManage(row,ctx))throw new ModuleError("Contato fora do escopo.",403);}
 const result=await db.execute(sql`SELECT modules_merge_contacts(${p.sourceId}::uuid,${p.targetId}::uuid,${p.sourceRevision},${p.targetRevision},${ctx.user.id}::uuid,${JSON.stringify(ctx.session.departmentIds)}::jsonb) AS counts`);
 return {counts:result.rows[0].counts};
}
export async function linkLegacy(id:string,input:unknown,ctx:Context) {
 const p=z.object({citizenId:z.string().uuid(),revision:z.number().int().positive()}).parse(input);
 const row=await getRecord(id,ctx);if(row.family!=="contatos"||!canManage(row,ctx))throw new ModuleError("Contato fora do escopo.",403);
 // Tax ID must match exactly: no name/email heuristic may move an authenticated identity.
 const result=await db.execute(sql`SELECT modules_contact_link_legacy(${id}::uuid,${p.citizenId}::uuid,${p.revision},${ctx.user.id}::uuid,${JSON.stringify(ctx.session.departmentIds)}::jsonb) AS linked`);
 return result.rows[0];
}
