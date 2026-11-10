import { db } from "@/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
export const reportFilters=z.object({from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),department:z.string().uuid().optional(),user:z.string().uuid().optional(),module:z.string().max(80).optional()}).refine(f=>Number.isFinite(Date.parse(f.from))&&Number.isFinite(Date.parse(f.to))&&f.from<=f.to,"Período inválido");
export type ReportRow={id:string;category:string;indicator:string;value:number;unit:string;source:string};
export async function report(filters:z.infer<typeof reportFilters>){
 const f=filters;
 // Each source is aggregated independently: joins do not multiply counts.
 const docs=sql`d.created_at >= ${f.from}::date AND d.created_at < (${f.to}::date + interval '1 day') ${f.department?sql`AND d.origin_department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND d.created_by_id=${f.user}::uuid`:sql``} ${f.module?sql`AND d.type::text=${f.module}`:sql``}`;
 const result=await db.execute(sql`WITH scoped AS (SELECT d.* FROM document d WHERE ${docs}),
 movements AS (SELECT m.* FROM document_movement m JOIN document d ON d.id=m.document_id WHERE m.created_at>=${f.from}::date AND m.created_at<(${f.to}::date+interval '1 day') ${f.department?sql`AND coalesce(m.from_department_id,m.to_department_id)=${f.department}::uuid`:sql``} ${f.user?sql`AND m.actor_user_id=${f.user}::uuid`:sql``} ${f.module?sql`AND d.type::text=${f.module}`:sql``}),
 audits AS (SELECT a.* FROM audit_log a LEFT JOIN app_user u ON a.actor_id=u.id::text WHERE a.created_at>=${f.from}::date AND a.created_at<(${f.to}::date+interval '1 day') ${f.department?sql`AND u.department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND a.actor_id=${f.user}`:sql``} ${f.module?sql`AND a.entity_type=${f.module}`:sql``})
 SELECT 'volume' AS id,'Volumetria' AS category,'Documentos criados' AS indicator,count(*)::float AS value,'documentos' AS unit,'document.created_at' AS source FROM scoped
 UNION ALL SELECT 'closed','Eficiência','Documentos do período concluídos ou arquivados',count(*)::float,'documentos','document.status atual' FROM scoped WHERE status IN ('CONCLUDED','ARCHIVED')
 UNION ALL SELECT 'moves','Produtividade','Movimentações registradas no período',count(*)::float,'eventos','document_movement.created_at / actor_user_id' FROM movements
 UNION ALL SELECT 'reads','Leitura','Primeiras leituras no período',count(*)::float,'leituras','document_read_receipt.first_read_at' FROM document_read_receipt r JOIN document d ON d.id=r.document_id WHERE r.first_read_at>=${f.from}::date AND r.first_read_at<(${f.to}::date+interval '1 day') ${f.department?sql`AND d.origin_department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND r.user_id=${f.user}::uuid`:sql``} ${f.module?sql`AND d.type::text=${f.module}`:sql``}
 UNION ALL SELECT 'bytes','Consumo','Tamanho cadastrado dos anexos dos documentos criados',coalesce(sum(a.size),0)::float,'bytes','attachment.size; não equivale à fatura do provedor' FROM attachment a JOIN scoped d ON d.id=a.document_id
 UNION ALL SELECT 'overdue','Qualidade','Prazos pendentes vencidos dos documentos criados',count(*)::float,'prazos','document_deadline; posição atual' FROM document_deadline p JOIN scoped d ON d.id=p.document_id WHERE p.status='PENDING' AND p.due_at<now()
 UNION ALL SELECT 'audit','Auditoria','Eventos auditados no período',count(*)::float,'eventos','audit_log.created_at' FROM audits
 UNION ALL SELECT 'days','Assiduidade digital','Dias com ações auditadas (não é ponto funcional)',count(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date)::float,'dias','audit_log; somente ações instrumentadas' FROM audits
 UNION ALL SELECT 'access','Acessos','Eventos explícitos de login registrados',count(*)::float,'eventos','audit_log.action LOGIN / AUTH_LOGIN / SESSION_LOGIN' FROM audits WHERE action IN ('LOGIN','AUTH_LOGIN','SESSION_LOGIN')`);
 const rows=result.rows as ReportRow[];
 const tickets=await db.execute(sql`SELECT count(*)::float AS total,
 count(*) FILTER(WHERE coalesce(t.resolved_at,now())>t.due_at)::float AS late,
 avg(t.rating)::float AS rating,
 avg(extract(epoch FROM(t.resolved_at-t.created_at))/3600)::float AS hours
 FROM operation_ticket t JOIN app_user u ON u.id=t.requester_id
 WHERE t.created_at>=${f.from}::date AND t.created_at<(${f.to}::date+interval '1 day')
 ${f.department?sql`AND u.department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND t.requester_id=${f.user}::uuid`:sql``}
 ${f.module?sql`AND ${f.module}='SUPPORT'`:sql``}`);
 const t=tickets.rows[0];
 rows.push({id:"tickets",category:"Suporte",indicator:"Chamados abertos no período",value:Number(t.total),unit:"chamados",source:"operation_ticket.created_at; setor do solicitante atual"},
 {id:"ticket-late",category:"Suporte",indicator:"Chamados com prazo de solução excedido",value:Number(t.late),unit:"chamados",source:"operation_ticket.due_at / resolved_at; posição atual"});
 if(t.rating!==null)rows.push({id:"rating",category:"Qualidade",indicator:"Avaliação média dos chamados avaliados",value:Number(t.rating),unit:"nota de 1 a 5",source:"operation_ticket.rating"});
 if(t.hours!==null)rows.push({id:"resolution",category:"Eficiência",indicator:"Tempo médio até solução dos chamados resolvidos",value:Number(t.hours),unit:"horas",source:"operation_ticket.resolved_at - created_at"});
 const exists=await db.execute(sql`SELECT to_regclass('public.module_record') IS NOT NULL AS ready`);
 if(exists.rows[0]?.ready){
 const modules=await db.execute(sql`SELECT family,count(*)::float AS total,
 count(*) FILTER(WHERE data->'values'->>'latitude' IS NOT NULL AND data->'values'->>'longitude' IS NOT NULL)::float AS located,
 coalesce(sum(CASE WHEN jsonb_typeof(data->'geometry'->'features')='array' THEN jsonb_array_length(data->'geometry'->'features') ELSE 0 END),0)::float AS features
 FROM module_record WHERE created_at>=${f.from}::date AND created_at<(${f.to}::date+interval '1 day')
 ${f.department?sql`AND department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND owner_id=${f.user}::uuid`:sql``} ${f.module?sql`AND family=${f.module}`:sql``} GROUP BY family ORDER BY family`);
 for(const m of modules.rows){rows.push({id:`module-${m.family}`,category:"Módulos",indicator:`Registros: ${m.family}`,value:Number(m.total),unit:"registros",source:"module_record.created_at / owner_id"});
 if(m.family==="fiscalizacao")rows.push({id:"geo-inspections",category:"Georreferenciamento",indicator:"Fiscalizações com coordenadas cadastradas",value:Number(m.located),unit:"registros",source:"module_record.data.values latitude/longitude; não valida precisão de GPS"});
 if(m.family==="camadas")rows.push({id:"geo-features",category:"Georreferenciamento",indicator:"Feições das camadas cadastradas",value:Number(m.features),unit:"feições",source:"module_record.data.geometry.features"});}
 }
 return rows;
}
