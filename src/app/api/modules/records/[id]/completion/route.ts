import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { department } from "@/db/schema";
import { moduleRecord } from "@/db/modules-schema";
import { context, getRecord, failure, ModuleError } from "@/lib/modules/server";
import { canManage } from "@/lib/modules/policy";
import { workflowDeadline } from "@/lib/modules/business-hours";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params:paramsPromise}:{params:Promise<{id:string}>}) {
 const params = await paramsPromise;
 try {const ctx=await context(req);await getRecord(params.id,ctx);const tags=await db.execute(sql`SELECT label,department_id FROM module_sector_tag WHERE record_id=${params.id}::uuid AND department_id::text IN (SELECT jsonb_array_elements_text(${JSON.stringify(ctx.session.departmentIds)}::jsonb))`);return Response.json({tags:tags.rows});}catch(e){return failure(e);}
}
export async function POST(req:Request,{params:paramsPromise}:{params:Promise<{id:string}>}) {
 const params = await paramsPromise;
 try {
  const ctx=await context(req,"doc:edit");const row=await getRecord(params.id,ctx);if(!canManage(row,ctx))throw new ModuleError("Sem permissão para alterar.",403);
  const input=z.object({revision:z.number().int().positive(),action:z.enum(["ROUTE","EDITION","TAGS","PASSCODE","CANCEL_PASSCODE","USE_PASSCODE"]),payload:z.record(z.unknown()),note:z.string().trim().min(3).max(1000)}).parse(await req.json());
  if(row.status==="PUBLICADO"||row.revision!==input.revision)throw new ModuleError("Registro publicado ou atualizado. Recarregue.",409);
  const data=structuredClone(row.data);let departmentId=row.departmentId;let participants=row.participants;
  if(input.action==="ROUTE") {
   const p=z.object({departmentId:z.string().uuid(),hours:z.number().int().min(1).max(87600)}).parse(input.payload);const step=data.workflow?.steps[data.step??0];
   if(row.status!=="EM_ANDAMENTO"||!step||!ctx.session.departmentIds.some(id=>step.departments.includes(id))||!data.workflow?.routingDepartments?.includes(p.departmentId))throw new ModuleError("Roteamento não autorizado pelo fluxo ou setor atual.",403);
   if(data.workflow.family==="pessoal"&&p.departmentId!==data.workflow.rhDepartmentId)throw new ModuleError("Requerimento pessoal restrito ao RH.",403);
   const [sector]=await db.select().from(department).where(and(eq(department.id,p.departmentId),eq(department.active,true)));if(!sector)throw new ModuleError("Setor inativo.");
   data.workflow.steps.splice(data.step??0,0,{name:`Diligência: ${sector.name}`,departments:[sector.id],hours:p.hours,decision:false});data.completedDepartments=[];data.dueAt=await workflowDeadline(p.hours,data.workflow.businessDays,[sector.id]);departmentId=sector.id;participants=Array.from(new Set([...participants,sector.id]));
  } else if(input.action==="EDITION") {
   if(row.family!=="diario"||row.status!=="AGUARDANDO_ASSINATURA"||!data.publication)throw new ModuleError("Prepare a edição antes de organizar atos.");
   const items=z.array(z.object({id:z.string().uuid(),section:z.string().max(200),subsection:z.string().max(200),withdrawn:z.boolean()})).max(100).parse(input.payload.items);
   if(items.length!==data.publication.length||new Set(items.map(i=>i.id)).size!==items.length||items.some(i=>!data.publication!.some(a=>a.id===i.id)))throw new ModuleError("A organização deve conter todos os atos preservados, inclusive retirados.");
   data.publication=items.map(i=>({...data.publication!.find(a=>a.id===i.id)!,...i}));data.sealedHash=createHash("sha256").update(JSON.stringify(data.publication)).digest("hex");
  } else if(input.action==="TAGS") {
   const p=z.object({departmentId:z.string().uuid(),labels:z.array(z.string().trim().min(1).max(60)).max(30)}).parse(input.payload);
   if(!ctx.session.departmentIds.includes(p.departmentId))throw new ModuleError("Etiquetas restritas aos seus setores.",403);
   const changed=await db.execute(sql`WITH target AS (UPDATE module_record SET revision=revision+1,actor_id=${ctx.user.id}::uuid,external_actor_uid=NULL,action='ETIQUETAS_SETORIAIS',note=${input.note}
    WHERE id=${row.id}::uuid AND revision=${input.revision} AND status<>'PUBLICADO' RETURNING id),
    removed AS (DELETE FROM module_sector_tag WHERE record_id IN (SELECT id FROM target) AND department_id=${p.departmentId}::uuid AND label NOT IN (SELECT jsonb_array_elements_text(${JSON.stringify(p.labels)}::jsonb))),
    inserted AS (INSERT INTO module_sector_tag(record_id,department_id,label,actor_id) SELECT target.id,${p.departmentId}::uuid,value,${ctx.user.id}::uuid FROM target CROSS JOIN jsonb_array_elements_text(${JSON.stringify([...new Set(p.labels)])}::jsonb) ON CONFLICT DO NOTHING)
    SELECT id FROM target`);
   if(!changed.rows.length)throw new ModuleError("Registro atualizado. Recarregue as etiquetas.",409);
   return Response.json({saved:true});
  } else if(input.action==="PASSCODE") {
   if(row.ownerId!==ctx.user.id||row.status!=="RASCUNHO")throw new ModuleError("Somente o titular pode conceder contrassenha para seu rascunho.",403);
   const p=z.object({recipientId:z.string().uuid(),minutes:z.number().int().min(1).max(1440)}).parse(input.payload);const token=randomBytes(24).toString("hex");const hash=createHash("sha256").update(token).digest("hex");
   const result=await db.execute(sql`WITH created AS (INSERT INTO module_passcode(record_id,issuer_id,recipient_id,token_hash,expires_at) VALUES(${row.id}::uuid,${ctx.user.id}::uuid,${p.recipientId}::uuid,${hash},now()+${p.minutes}*interval '1 minute') RETURNING id)
    INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) SELECT 'USER',${ctx.user.id},'MODULE_PASSCODE_GRANTED','module_record',${row.id},jsonb_build_object('grantId',id,'recipientId',${p.recipientId}::text) FROM created RETURNING metadata`);
   return Response.json({token,grantId:(result.rows[0].metadata as {grantId:string}).grantId},{headers:{"cache-control":"no-store"}});
  } else if(input.action==="CANCEL_PASSCODE") {
   const id=z.string().uuid().parse(input.payload.grantId);
   const cancelled=await db.execute(sql`WITH revoked AS (UPDATE module_passcode SET cancelled_at=now() WHERE id=${id}::uuid AND record_id=${row.id}::uuid AND issuer_id=${ctx.user.id}::uuid AND used_at IS NULL AND cancelled_at IS NULL RETURNING id)
    INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) SELECT 'USER',${ctx.user.id},'MODULE_PASSCODE_CANCELLED','module_record',${row.id},jsonb_build_object('grantId',id) FROM revoked RETURNING id`);
   if(!cancelled.rows.length)throw new ModuleError("Concessão inexistente, já consumida/cancelada ou pertencente a outro autorizador.",409);
   return Response.json({saved:true});
  } else {
   const token=z.string().regex(/^[a-f0-9]{48}$/).parse(input.payload.token);const hash=createHash("sha256").update(token).digest("hex");
   const result=await db.execute(sql`WITH target AS MATERIALIZED (SELECT id FROM module_record WHERE id=${row.id}::uuid AND revision=${input.revision} AND status='RASCUNHO' FOR UPDATE),
    consumed AS (UPDATE module_passcode SET used_at=now() WHERE token_hash=${hash} AND record_id=${row.id}::uuid AND recipient_id=${ctx.user.id}::uuid AND expires_at>now() AND used_at IS NULL AND cancelled_at IS NULL AND EXISTS(SELECT 1 FROM target) RETURNING issuer_id)
    UPDATE module_record SET revision=revision+1,actor_id=${ctx.user.id}::uuid,external_actor_uid=NULL,action='CONTRASSENHA_UTILIZADA',note=${input.note},data=jsonb_set(data,'{values}',coalesce(data->'values','{}')||jsonb_build_object('autorizador',(SELECT issuer_id FROM consumed)::text,'digitador',${ctx.user.id}::text)) WHERE id=${row.id}::uuid AND EXISTS(SELECT 1 FROM consumed) RETURNING id`);
   if(!result.rows.length)throw new ModuleError("Contrassenha inválida, vencida, cancelada, consumida ou registro atualizado.",409);return Response.json({saved:true});
  }
  const changed=await db.update(moduleRecord).set({data,departmentId,participants,revision:row.revision+1,actorId:ctx.user.id,externalActorUid:null,action:input.action,note:input.note}).where(and(eq(moduleRecord.id,row.id),eq(moduleRecord.revision,input.revision))).returning({id:moduleRecord.id});
  if(!changed.length)throw new ModuleError("Conflito de versão.",409);return Response.json({saved:true});
 }catch(e){return failure(e);}
}
