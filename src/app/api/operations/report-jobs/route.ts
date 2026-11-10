import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { actor,failure,OperationError } from '@/lib/operations/server';
import { reportFilters } from '@/lib/operations/reports';
import { reportKey,retentionIds } from '@/lib/operations/snapshot-helpers';
import { z } from 'zod';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{
 const {user}=await actor(req,'operations:reports');const b=z.object({filters:reportFilters,format:z.enum(['csv','pdf','xlsx']),requestId:z.string().uuid()}).parse(await req.json());
 const key=reportKey(b.filters,b.format);const [,result]=await db.batch([db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id+key}))`),db.execute(sql`WITH existing AS(SELECT id FROM operation_report_job WHERE owner_id=${user.id}::uuid AND filters=${JSON.stringify(b.filters)}::jsonb AND format=${b.format} AND (status IN('QUEUED','RUNNING') OR(status='READY' AND expires_at>now())) ORDER BY created_at DESC LIMIT 1), inserted AS(INSERT INTO operation_report_job(owner_id,request_key,filters,format) SELECT ${user.id}::uuid,${key+':'+b.requestId},${JSON.stringify(b.filters)}::jsonb,${b.format} WHERE NOT EXISTS(SELECT 1 FROM existing) ON CONFLICT(owner_id,request_key) DO UPDATE SET request_key=excluded.request_key RETURNING id) SELECT id FROM existing UNION ALL SELECT id FROM inserted`)]);
 return Response.json({id:result.rows[0].id,message:'Relatório solicitado. A geração ocorre no executor operacional; acompanhe em Relatórios prontos.'},{status:202});
 }catch(e){return failure(e);}}
export async function GET(req:Request){try{const {user}=await actor(req,'operations:reports');
 const rows=await db.execute(sql`SELECT id,format,filters,CASE WHEN status='READY' AND expires_at<=now() THEN 'EXPIRED' ELSE status END status,created_at,completed_at,expires_at,error,notified_at FROM operation_report_job WHERE owner_id=${user.id}::uuid AND (status IN('QUEUED','RUNNING','FAILED') OR(status='READY' AND expires_at>now())) ORDER BY created_at DESC`);
 const kept=new Set(retentionIds(rows.rows.filter(r=>r.status==='READY').map(r=>({id:String(r.id),completedAt:new Date(String(r.completed_at)).toISOString(),expiresAt:new Date(String(r.expires_at)).toISOString()})),new Date()));
 return Response.json({rows:rows.rows.filter(r=>r.status!=='READY'||kept.has(String(r.id)))},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return failure(e);}}
export async function PATCH(req:Request){try{const {user}=await actor(req,'operations:reports');const {id}=z.object({id:z.string().uuid()}).parse(await req.json());const r=await db.execute(sql`UPDATE operation_report_job SET notified_at=coalesce(notified_at,now()) WHERE id=${id}::uuid AND owner_id=${user.id}::uuid RETURNING id`);if(!r.rows.length)throw new OperationError(404,'Relatório não encontrado.');return Response.json({ok:true});}catch(e){return failure(e);}}
