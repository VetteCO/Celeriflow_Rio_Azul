import {z} from "zod";
import {validateFields,validTaxId} from "./domain";
export const contactTypes=["Pessoa física","Pessoa jurídica","Setor de organização"] as const;
export const contactBaseKeys=["cpfCnpj","email","phone","cep","endereco","organizacao"] as const;
export const contactFieldSchema=z.object({key:z.string().regex(/^extra_[a-zA-Z0-9_]{1,40}$/),label:z.string().trim().min(1).max(100),help:z.string().max(1000),type:z.enum(["text","number","date","select","cpfCnpj","cep","phone"]),options:z.array(z.string().min(1).max(100)).max(50).default([]),required:z.boolean(),channel:z.enum(["INTERNO","EXTERNO","AMBOS"])});
export const profileSchema=z.object({name:z.string().trim().min(2).max(100),active:z.boolean().default(true),definition:z.object({types:z.array(z.enum(contactTypes)).min(1),base:z.array(z.object({key:z.enum(contactBaseKeys),enabled:z.boolean(),required:z.boolean()})).max(6),fields:z.array(contactFieldSchema).max(10)}).superRefine((d,c)=>{
 if(new Set(d.fields.map(f=>f.key)).size!==d.fields.length||new Set(d.base.map(f=>f.key)).size!==d.base.length)c.addIssue({code:"custom",message:"Chaves de campos não podem repetir."});
 if(d.base.some(f=>f.required&&!f.enabled))c.addIssue({code:"custom",message:"Campo obrigatório precisa estar habilitado."});
 if(["cpfCnpj","email","phone"].every(k=>d.base.some(f=>f.key===k&&!f.enabled)))c.addIssue({code:"custom",message:"Habilite ao menos um identificador (CPF/CNPJ, e-mail ou celular)."});
 if(d.fields.some(f=>f.type==="select"&&!f.options.length))c.addIssue({code:"custom",message:"Seletores exigem opções."});
})});
export type ContactProfile={id:string;name:string;revision:number;active:boolean;definition:z.infer<typeof profileSchema>["definition"]};
export function validateContactProfile(profile:ContactProfile,type:string,values:Record<string,string>,channel:"INTERNO"|"EXTERNO",previous:Record<string,string>={}) {
 if(!profile.active||!profile.definition.types.includes(type as typeof contactTypes[number]))throw new Error("Perfil indisponível para este tipo de contato.");
 const result:Record<string,string>={...previous,...values,tipo:type,contactProfileId:profile.id};
 for(const rule of profile.definition.base){
  if(!rule.enabled){if(values[rule.key]!==undefined&&values[rule.key]!==previous[rule.key]&&!(previous[rule.key]===undefined&&values[rule.key]===""))throw new Error(`Campo ${rule.key} desabilitado neste perfil.`);if(previous[rule.key]===undefined)delete result[rule.key];}
  if(rule.enabled&&rule.required&&!result[rule.key]?.trim())throw new Error(`Preencha ${rule.key}.`);
 }
 for(const field of profile.definition.fields){
  if(field.channel!=="AMBOS"&&field.channel!==channel){if(values[field.key]!==undefined&&values[field.key]!==previous[field.key])throw new Error(`Campo ${field.label} não disponível neste canal.`);continue;}
  validateFields([field],result);
  if(result[field.key]&&field.type==="phone"&&!/^\d{10,11}$/.test(result[field.key].replace(/\D/g,"")))throw new Error(`${field.label}: telefone inválido.`);
  if(result[field.key]&&field.type==="cep"&&!/^\d{8}$/.test(result[field.key].replace(/\D/g,"")))throw new Error(`${field.label}: CEP inválido.`);
 }
 const allowed=new Set(profile.definition.fields.filter(f=>f.channel==="AMBOS"||f.channel===channel).map(f=>f.key));
 for(const key of Object.keys(values))if(key.startsWith("extra_")&&!allowed.has(key)&&values[key]!==previous[key])throw new Error("Campo complementar não configurado para este canal.");
 if(!["cpfCnpj","email","phone"].some(k=>result[k]?.trim()))throw new Error("Informe CPF/CNPJ, e-mail ou celular.");
 if(result.cpfCnpj&&!validTaxId(result.cpfCnpj))throw new Error("CPF/CNPJ inválido.");
 if(result.email&&!z.string().email().safeParse(result.email).success)throw new Error("E-mail inválido.");
 if(result.phone&&!/^\d{10,11}$/.test(result.phone.replace(/\D/g,"")))throw new Error("Celular inválido.");
 if(result.cep&&!/^\d{8}$/.test(result.cep.replace(/\D/g,"")))throw new Error("CEP inválido.");
 return result;
}
export function externalContactValues(profile:ContactProfile,values:Record<string,string>){
 const keys=new Set<string>(["tipo",...contactBaseKeys.filter(k=>profile.definition.base.find(b=>b.key===k)?.enabled!==false),...profile.definition.fields.filter(f=>f.channel!=="INTERNO").map(f=>f.key)]);
 return Object.fromEntries(Object.entries(values).filter(([key])=>keys.has(key)));
}
