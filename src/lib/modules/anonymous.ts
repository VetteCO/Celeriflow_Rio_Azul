import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { moduleFile, moduleRecord } from "@/db/modules-schema";
import { ModuleError } from "./server";
import { workflowDeadline } from "./business-hours";
import { channelAllows, fieldState } from "./domain";
import { workflowValues } from "./workflow-values";

export const anonymousKey = z.string().regex(/^[a-f0-9]{64}$/);
export const anonymousHeaders = { "cache-control": "private, no-store", "referrer-policy": "no-referrer" };
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function anonymousRecord(key: string) {
 const hash = digest(anonymousKey.parse(key));
 const [row] = await db.select().from(moduleRecord).where(and(eq(moduleRecord.family,"ouvidoria"),sql`data->'values'->>'modalidade'='Anônima' AND EXISTS(SELECT 1 FROM module_anonymous_access WHERE record_id=${moduleRecord.id} AND token_hash=${hash})`));
 if (!row) throw new ModuleError("Chave de acompanhamento inválida.",404);
 return row;
}
export async function anonymousOptions() {
 const rows = await db.select().from(moduleRecord).where(and(eq(moduleRecord.family,"fluxos"),eq(moduleRecord.status,"ATIVO"),sql`data->'workflow'->>'family'='ouvidoria' AND data->'values'->>'anonymousEnabled'='Sim'`));
  return rows.filter(r=>r.data.workflow?.identityDepartmentId).map(r=>({id:r.id,title:r.title,fields:r.data.workflow!.fields.filter(f=>channelAllows(f,"EXTERNO")),requiredFiles:r.data.workflow!.requiredFiles}));
}
export async function anonymousRead(key: string) {
 const r=await anonymousRecord(key);
 const files=await db.select({id:moduleFile.id,filename:moduleFile.filename,category:moduleFile.category,size:moduleFile.size}).from(moduleFile).where(and(eq(moduleFile.recordId,r.id),eq(moduleFile.externalVisible,true)));
 const complete=(r.data.workflow?.steps[r.data.step??0]?.departments??[]).every(id=>r.data.completedDepartments?.includes(id));
  return {code:r.code,title:r.title,body:r.body,status:r.status,revision:r.revision,dueAt:r.data.dueAt,
   fields:r.data.workflow?.fields.filter(f=>channelAllows(f,"EXTERNO"))??[],
   values:Object.fromEntries(Object.entries(r.data.values??{}).filter(([key])=>r.data.workflow?.fields.some(f=>f.key===key&&fieldState(f,r.data.values??{},"EXTERNO").visible))),
   editableFields:["RASCUNHO","EM_ANDAMENTO"].includes(r.status)&&!r.data.signatures?.some(s=>s.status==="PENDENTE")?r.data.workflow?.fields.filter(f=>fieldState(f,r.data.values??{},"EXTERNO",r.status!=="RASCUNHO").editable).map(f=>f.key)??[]:[],
  requiredFiles:r.data.workflow?.requiredFiles??[],files,evaluation:r.data.evaluation,
  canEvaluate:complete&&["CONCLUIDO","DEFERIDO","INDEFERIDO","ARQUIVADO"].includes(r.status),
  messages:(r.data.messages??[]).filter(m=>m.visibility==="EXTERNA").map(m=>({text:m.text,at:m.at,source:m.actorId==="INTERESSADO"?"Manifestante":"Ouvidoria"}))};
}
export async function anonymousCreate(input: unknown) {
  const p=z.object({key:anonymousKey,workflowId:z.string().uuid(),title:z.string().trim().min(3).max(250),body:z.string().trim().min(10).max(20000),purpose:z.enum(["Denúncia","Elogio","Reclamação","Solicitação","Sugestão"]),values:z.record(z.string(),z.string().max(5000)).default({})}).parse(input);
 const [flow]=await db.select().from(moduleRecord).where(and(eq(moduleRecord.id,p.workflowId),eq(moduleRecord.family,"fluxos"),eq(moduleRecord.status,"ATIVO"),sql`data->'values'->>'anonymousEnabled'='Sim'`));
 const workflow=flow?.data.workflow;
 if(!workflow?.identityDepartmentId||workflow.family!=="ouvidoria") throw new ModuleError("Assunto indisponível.",409);
  const submitted=Object.fromEntries(workflow.fields.filter(f=>!["modalidade","finalidade","cadastroPrincipal"].includes(f.key)&&Object.hasOwn(p.values,f.key)).map(f=>[f.key,p.values[f.key]]));
  submitted.modalidade="Anônima";submitted.finalidade=p.purpose;
  let values:Record<string,string>;
  try {values=workflowValues(workflow,submitted,{channel:"EXTERNO"});} catch(e){throw new ModuleError((e as Error).message);}
 const data={values,workflow,workflowId:flow.id,workflowRevision:flow.revision,step:0,externalSubmission:true,identityDepartmentId:workflow.identityDepartmentId};
  const fingerprint=digest(JSON.stringify({title:p.title,body:p.body,workflowId:p.workflowId,values:Object.entries(submitted).sort()}));
 const result=await db.execute(sql`SELECT modules_anonymous_create(${digest(p.key)},${fingerprint},${flow.id}::uuid,${flow.revision},${p.title},${p.body},${JSON.stringify(data)}::jsonb) AS code`);
 return {code:result.rows[0].code};
}
export async function anonymousWrite(key:string,operationId:string,revision:number,action:string,payload:Record<string,unknown>,fingerprint?:string) {
 anonymousKey.parse(key);z.string().uuid().parse(operationId);z.number().int().positive().parse(revision);
 const result=await db.execute(sql`SELECT modules_anonymous_write(${digest(key)},${operationId}::uuid,${fingerprint??digest(JSON.stringify({action,payload}))},${revision},${action},${JSON.stringify(payload)}::jsonb) AS result`);
 return result.rows[0].result as {saved:boolean;revision:number;fileId?:string};
}
export async function anonymousCommand(input: unknown) {
  const p=z.object({action:z.enum(["REPLY","EVALUATE","SUBMIT","FIELDS"]),key:anonymousKey,operationId:z.string().uuid(),revision:z.number().int().positive(),values:z.record(z.string(),z.string().max(5000)).optional(),text:z.string().trim().max(20000).default(""),score:z.number().int().min(1).max(5).optional()}).parse(input);
  if(p.action==="FIELDS") {
    const row=await anonymousRecord(p.key), fingerprint=digest(JSON.stringify({action:p.action,values:Object.entries(p.values??{}).sort()}));
    const previous=await db.execute(sql`SELECT payload_hash,result FROM module_anonymous_operation WHERE record_id=${row.id}::uuid AND operation_id=${p.operationId}::uuid`);
    if(previous.rows.length) {if(previous.rows[0].payload_hash!==fingerprint)throw new ModuleError("Identificador reutilizado com outro conteúdo.",409);return previous.rows[0].result;}
    if(!row.data.workflow||!p.values||!["RASCUNHO","EM_ANDAMENTO"].includes(row.status))throw new ModuleError("Manifestação não admite alteração de campos.",409);
    if(row.data.signatures?.some(s=>s.status==="PENDENTE"))throw new ModuleError("A alteração está bloqueada enquanto houver assinatura pendente.",409);
    if(Object.keys(p.values).some(key=>!row.data.workflow!.fields.some(f=>f.key===key)))throw new ModuleError("Informe somente campos do formulário.");
    let values:Record<string,string>;try{values=workflowValues(row.data.workflow,p.values,{channel:"EXTERNO",previous:row.data.values,afterProtocol:row.status!=="RASCUNHO"});}catch(e){throw new ModuleError((e as Error).message);}
    const result=await db.execute(sql`SELECT modules_anonymous_fields(${digest(p.key)},${p.operationId}::uuid,${fingerprint},${p.revision},${JSON.stringify(values)}::jsonb) AS result`);
    return result.rows[0].result;
  }
 if(p.action==="REPLY"&&!p.text) throw new ModuleError("Informe a complementação.");
 if(p.action==="EVALUATE"&&p.score===undefined) throw new ModuleError("Escolha de uma a cinco estrelas.");
 const payload:Record<string,unknown>={text:p.text,score:p.score};
 if(p.action==="SUBMIT") {const row=await anonymousRecord(p.key);if(!row.data.workflow)throw new ModuleError("Fluxo indisponível.");payload.dueAt=await workflowDeadline(row.data.workflow.steps[0].hours,row.data.workflow.businessDays,row.data.workflow.steps[0].departments);}
 return anonymousWrite(p.key,p.operationId,p.revision,p.action,payload,digest(JSON.stringify({action:p.action,text:p.text,score:p.score})));
}
// Avoid logging secret-bearing request bodies or SQL parameters from anonymous requests.
export function anonymousFailure(e: unknown) {
 if(e instanceof z.ZodError) return Response.json({error:"Dados inválidos. Confira os campos e a chave."},{status:400,headers:anonymousHeaders});
 if(e instanceof ModuleError) return Response.json({error:e.message},{status:e.status,headers:anonymousHeaders});
 return Response.json({error:"Operação não concluída. Consulte a manifestação e confira o estado, a revisão e os limites de anexos antes de tentar novamente."},{status:409,headers:anonymousHeaders});
}
