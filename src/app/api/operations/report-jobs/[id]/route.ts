import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { actor,failure,OperationError } from '@/lib/operations/server';
import { downloadAttachment } from '@/lib/blob';
import { z } from 'zod';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const {user}=await actor(req,'operations:reports');const id=z.string().uuid().parse((await params).id);
 const r=await db.execute(sql`SELECT format,output_key,output_hash,snapshot FROM operation_report_job WHERE id=${id}::uuid AND owner_id=${user.id}::uuid AND status='READY' AND expires_at>now()`);const job=r.rows[0];if(!job)throw new OperationError(404,'Relatório indisponível ou expirado.');
 if(new URL(req.url).searchParams.get('snapshot')==='1')return Response.json({snapshot:job.snapshot},{headers:{'Cache-Control':'private, no-store'}});
 const file=await downloadAttachment(String(job.output_key));if(!file)throw new OperationError(410,'Arquivo indisponível. Solicite nova geração.');
 await db.execute(sql`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id) VALUES('USER',${user.id},'OPERATIONS_READY_REPORT_DOWNLOAD','operation_report_job',${id})`);
 const mime={csv:'text/csv; charset=utf-8',pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[String(job.format)]||'application/octet-stream';
 return new Response(file.stream,{headers:{'Content-Type':mime,'Content-Disposition':`attachment; filename="relatorio-${id}.${job.format}"`,'Cache-Control':'private, no-store','X-Content-SHA256':String(job.output_hash)}});
 }catch(e){return failure(e);}}
