import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { moduleRecord } from "@/db/modules-schema";
import { failure, ModuleError } from "@/lib/modules/server";
import { deadline } from "@/lib/modules/calendar";
export const dynamic="force-dynamic";
export async function POST(req:Request) {
 try {
  const input=z.discriminatedUnion("action",[
   z.object({action:z.literal("CREATE"), title:z.string().trim().min(3).max(250), body:z.string().trim().min(10).max(20000), purpose:z.enum(["Denúncia","Elogio","Reclamação","Solicitação","Sugestão"])}),
   z.object({action:z.literal("READ"), key:z.string().regex(/^[a-f0-9]{64}$/)}),
   z.object({action:z.literal("REPLY"), key:z.string().regex(/^[a-f0-9]{64}$/), text:z.string().trim().min(1).max(20000),revision:z.number().int().positive()})
  ]).parse(await req.json());
  if(input.action==="CREATE") {
   const [flow]=await db.select().from(moduleRecord).where(and(eq(moduleRecord.family,"fluxos"),eq(moduleRecord.status,"ATIVO"),sql`data->'workflow'->>'family'='ouvidoria' AND data->'values'->>'anonymousEnabled'='Sim'`));
   const workflow=flow?.data.workflow;
   if(!workflow?.identityDepartmentId) throw new ModuleError("O recebimento anônimo ainda não foi configurado.",409);
   const token=randomBytes(32).toString("hex"); const hash=createHash("sha256").update(token).digest("hex");
   const data={values:{modalidade:"Anônima",finalidade:input.purpose},workflow,workflowId:flow.id,workflowRevision:flow.revision,step:0,externalSubmission:true,dueAt:await deadline(workflow.steps[0].hours,workflow.businessDays)};
   const result=await db.execute(sql`WITH created AS (INSERT INTO module_record(family,title,body,status,department_id,participants,data,action)
    VALUES('ouvidoria',${input.title},${input.body},'EM_ANDAMENTO',${workflow.steps[0].departments[0]}::uuid,${JSON.stringify(workflow.steps[0].departments)}::jsonb,${JSON.stringify(data)}::jsonb,'ANONIMO_PROTOCOLADO') RETURNING id,code),
    access AS (INSERT INTO module_anonymous_access(record_id,token_hash) SELECT id,${hash} FROM created)
    SELECT code FROM created`);
   return Response.json({key:token,code:result.rows[0].code},{status:201,headers:{"cache-control":"no-store"}});
  }
  const hash=createHash("sha256").update(input.key).digest("hex");
  const [row]=await db.select().from(moduleRecord).where(sql`EXISTS(SELECT 1 FROM module_anonymous_access WHERE record_id=${moduleRecord.id} AND token_hash=${hash})`);
  if(!row) throw new ModuleError("Chave de acompanhamento inválida.",404);
  if(input.action==="REPLY") {
   if(row.status!=="EM_ANDAMENTO") throw new ModuleError("Manifestação encerrada.",409);
   const data={...row.data,messages:[...(row.data.messages??[]),{text:input.text,visibility:"EXTERNA" as const,actorId:"INTERESSADO",at:new Date().toISOString()}]};
   const changed=await db.update(moduleRecord).set({data,revision:row.revision+1,actorId:null,externalActorUid:null,action:"ANONIMO_RESPONDEU",note:""}).where(and(eq(moduleRecord.id,row.id),eq(moduleRecord.revision,input.revision))).returning({id:moduleRecord.id});
   if(!changed.length) throw new ModuleError("Manifestação atualizada. Consulte novamente.",409);
   return Response.json({saved:true});
  }
  return Response.json({code:row.code,title:row.title,body:row.body,status:row.status,revision:row.revision,messages:(row.data.messages??[]).filter(m=>m.visibility==="EXTERNA").map(m=>({text:m.text,at:m.at,source:m.actorId==="INTERESSADO"?"Manifestante":"Ouvidoria"}))},{headers:{"cache-control":"no-store"}});
 }catch(e){return failure(e);}
}
