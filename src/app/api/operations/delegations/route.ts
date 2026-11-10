import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { actor,download,failure } from '@/lib/operations/server';
import { reportFilters } from '@/lib/operations/reports';
import { csv,pdf,xlsx } from '@/lib/operations/formats';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const {user}=await actor(req,'operations:reports');const p=new URL(req.url).searchParams,today=new Date().toISOString().slice(0,10);
 const f=reportFilters.parse({from:p.get('from')||today.slice(0,8)+'01',to:p.get('to')||today,department:p.get('department')||undefined,user:p.get('user')||undefined,module:p.get('module')||undefined});
 const result=await db.execute(sql`WITH issued AS(
 SELECT m.id::text id,'Delegação' kind,m.code,m.family,m.department_id,m.created_at at,m.data->'values'->>'autorizador' issuer,m.data->'values'->>'digitador' typist,m.data->'values'->>'delegacao' authorization,'EMITIDO' state
 FROM module_record m WHERE m.data->'values'->>'delegacao' IS NOT NULL
 UNION ALL SELECT p.id::text,'Contrassenha',m.code,m.family,m.department_id,p.used_at,p.issuer_id::text,p.recipient_id::text,p.id::text,CASE WHEN p.cancelled_at IS NULL THEN 'UTILIZADA' ELSE 'UTILIZADA / CANCELADA' END FROM module_passcode p JOIN module_record m ON m.id=p.record_id WHERE p.used_at IS NOT NULL)
 SELECT i.id,i.kind,i.code,i.family,i.at,i.authorization,i.state,coalesce(u.name,i.issuer,'Não registrado') issuer,coalesce(t.name,i.typist,'Não registrado') typist,coalesce(d.name,'Sem setor') department FROM issued i LEFT JOIN app_user u ON u.id::text=i.issuer LEFT JOIN app_user t ON t.id::text=i.typist LEFT JOIN department d ON d.id=i.department_id
 WHERE i.at>=${f.from}::date AND i.at<(${f.to}::date+interval '1 day') ${f.department?sql`AND i.department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND (i.issuer=${f.user} OR i.typist=${f.user})`:sql``} ${f.module?sql`AND i.family=${f.module}`:sql``} ORDER BY i.at DESC,i.id`);
 const format=p.get('format');if(format){await db.execute(sql`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,metadata) VALUES('USER',${user.id},'OPERATIONS_DELEGATION_EXPORT','operations_report',${JSON.stringify({filters:f,format})}::jsonb)`);const matrix:(string|number)[][]=[['Tipo','Código documental','Módulo','Data','Autorizador','Digitador / usuário','Autorização','Situação','Setor'],...result.rows.map(r=>[String(r.kind),String(r.code),String(r.family),new Date(String(r.at)).toISOString(),String(r.issuer),String(r.typist),String(r.authorization),String(r.state),String(r.department)])];
 if(format==='csv')return download(csv(matrix),'text/csv; charset=utf-8','delegacoes.csv');if(format==='xlsx')return download(xlsx(matrix),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','delegacoes.xlsx');if(format==='pdf')return download(pdf([`Delegação e contrassenha: ${f.from} a ${f.to}`,...matrix.map(r=>r.join(' | '))]),'application/pdf','delegacoes.pdf');return Response.json({error:'Formato inválido'},{status:400});}
 return Response.json({rows:result.rows,filters:f});
 }catch(e){return failure(e);}}
