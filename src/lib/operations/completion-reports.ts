import { operationsDb as db } from "./query";
import { sql } from "drizzle-orm";
import type { ReportRow, reportFilters } from "./reports";
import type { z } from "zod";

/** Aggregates never use subject/body/identity as labels. */
export async function completionReports(f:z.infer<typeof reportFilters>):Promise<ReportRow[]> {
 const rows:ReportRow[]=[];
 const add=(id:string,category:string,indicator:string,value:unknown,unit:string,source:string)=>{if(value!==null&&value!==undefined)rows.push({id,category,indicator,value:Number(value),unit,source});};
 const core=sql`d.created_at>=${f.from}::date AND d.created_at<(${f.to}::date+interval '1 day') ${f.department?sql`AND (d.origin_department_id=${f.department}::uuid OR EXISTS(SELECT 1 FROM document_participation p WHERE p.document_id=d.id AND p.department_id=${f.department}::uuid))`:sql``} ${f.user?sql`AND d.created_by_id=${f.user}::uuid`:sql``} ${f.module?sql`AND d.type::text=${f.module}`:sql``}`;
 const coreRows=await db.execute(sql`WITH cohort AS(SELECT d.* FROM document d WHERE ${core}), measured AS (
 SELECT d.*, (SELECT min(m.created_at) FROM document_movement m WHERE m.document_id=d.id AND m.action='RECEIVED' ${f.department?sql`AND m.to_department_id=${f.department}::uuid`:sql``}) received,
 (SELECT max(m.created_at) FROM document_movement m WHERE m.document_id=d.id AND m.action IN('CONCLUDED','ARCHIVED') ${f.department?sql`AND (m.from_department_id=${f.department}::uuid OR m.to_department_id=${f.department}::uuid)`:sql``}) closed,
 (SELECT min(r.first_read_at) FROM document_read_receipt r WHERE r.document_id=d.id) first_read,
 (SELECT min(m.created_at) FROM document_movement m WHERE m.document_id=d.id AND m.action NOT IN('CREATED','READ')) first_action FROM cohort d)
 SELECT count(*)::float total,count(*) FILTER(WHERE status IN('CONCLUDED','ARCHIVED'))::float closed_count,
 avg(extract(epoch FROM(closed-received))/3600) FILTER(WHERE status IN('CONCLUDED','ARCHIVED') AND closed>=received)::float hours,
 avg(extract(epoch FROM(first_read-created_at))/3600) FILTER(WHERE first_read>=created_at)::float read_hours,
 avg(extract(epoch FROM(first_action-created_at))/3600) FILTER(WHERE first_action>=created_at)::float action_hours FROM measured`);
 const c=coreRows.rows[0];
 add('core-received-cohort','Eficiência','Documentos criados ou recebidos pelo setor na população',c.total,'documentos','Criação no período; origem ou participação setorial; usuário = criador');
 if(Number(c.total))add('core-resolution-percent','Eficiência','Percentual atual de conclusão da população',100*Number(c.closed_count)/Number(c.total),'%','Concluídos/arquivados ÷ documentos da população; não reconstitui situação histórica');
 add('core-resolution-hours','Tempos','Tempo médio de recebimento até última conclusão registrada',c.hours,'horas','Eventos RECEIVED (destino) → CONCLUDED/ARCHIVED (origem ou destino) do setor selecionado; situação atual concluída; durações não negativas');
 add('core-read-hours','Tempos','Tempo médio até primeira leitura',c.read_hours,'horas','Primeiro recibo − criação; população documental do filtro');
 add('core-action-hours','Tempos','Tempo médio até primeira ação',c.action_hours,'horas','Primeiro movimento distinto de CREATED/READ − criação');
 const readers=await db.execute(sql`WITH expected AS(SELECT DISTINCT r.document_id,r.user_id FROM document_recipient r JOIN document d ON d.id=r.document_id WHERE d.created_at>=${f.from}::date AND d.created_at<(${f.to}::date+interval '1 day') ${f.department?sql`AND r.department_id=${f.department}::uuid`:sql``} ${f.module?sql`AND d.type::text=${f.module}`:sql``} AND r.user_id IS NOT NULL ${f.user?sql`AND r.user_id=${f.user}::uuid`:sql``}) SELECT count(*)::float total,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM document_read_receipt rr WHERE rr.document_id=e.document_id AND rr.user_id=e.user_id))::float read FROM expected e`);
 if(Number(readers.rows[0].total))add('core-engagement','Leitura','Leitura dos destinatários individuais cadastrados',100*Number(readers.rows[0].read)/Number(readers.rows[0].total),'%','Pares documento/usuário distintos com recibo ÷ destinatários individuais; setor destinatário e usuário leitor; destinos apenas setoriais não entram');
 const modules=sql`m.created_at>=${f.from}::date AND m.created_at<(${f.to}::date+interval '1 day') ${f.department?sql`AND m.department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND m.owner_id=${f.user}::uuid`:sql``} ${f.module?sql`AND m.family=${f.module}`:sql``}`;
 const result=await db.execute(sql`WITH cohort AS(SELECT m.* FROM module_record m WHERE ${modules}) SELECT m.family,count(*)::float total,
 count(*) FILTER(WHERE m.status IN('CONCLUIDO','ARQUIVADO','DEFERIDO','INDEFERIDO','PUBLICADO'))::float closed,
 avg(CASE WHEN jsonb_typeof(m.data->'evaluation'->'score')='number' THEN (m.data->'evaluation'->>'score')::numeric END)::float rating,
 (SELECT coalesce(sum(f.size),0)::float FROM module_file f JOIN cohort cm ON cm.id=f.record_id WHERE cm.family=m.family) bytes,
 (SELECT count(*)::float FROM module_file f JOIN cohort cm ON cm.id=f.record_id WHERE cm.family=m.family) files
 FROM cohort m GROUP BY m.family ORDER BY m.family`);
 for(const m of result.rows){const prefix=`completion-${m.family}`;
 add(`${prefix}-closed`,'Eficiência',`${m.family}: encerrados na situação atual`,m.closed,'registros','module_record.status; criação/setor proprietário/owner no filtro');
 add(`${prefix}-percent`,'Eficiência',`${m.family}: percentual encerrado`,100*Number(m.closed)/Number(m.total),'%','Encerrados ÷ criados no período; estados finais CONCLUIDO/ARQUIVADO/DEFERIDO/INDEFERIDO/PUBLICADO');
 add(`${prefix}-rating`,'Qualidade',`${m.family}: avaliação vigente média`,m.rating,'nota','data.evaluation.score numérico; somente avaliados, sem comentários ou identidade');
 add(`${prefix}-bytes`,'Consumo',`${m.family}: volume de anexos`,m.bytes,'bytes','module_file.size dos registros criados no período; não é custo de provedor');
 add(`${prefix}-files`,'Consumo',`${m.family}: anexos`,m.files,'arquivos','module_file por registro, agregado independente');
 }
 const events=await db.execute(sql`SELECT a.action,count(*)::float total FROM audit_log a JOIN module_record m ON m.id::text=a.entity_id
 WHERE left(a.action,7)='MODULE_' AND a.created_at>=${f.from}::date AND a.created_at<(${f.to}::date+interval '1 day')
 ${f.department?sql`AND m.department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND a.actor_id=${f.user}`:sql``} ${f.module?sql`AND m.family=${f.module}`:sql``} GROUP BY a.action ORDER BY a.action`);
 for(const e of events.rows)add(`event-${e.action}`,'Eventos dos módulos',String(e.action),e.total,'eventos','audit_log MODULE_* vinculado por entity_id; data do evento, usuário ator, setor atual do registro; não somar com auditoria geral');
 const delegations=await db.execute(sql`SELECT count(*)::float total FROM module_record m WHERE ${modules} AND m.data->'values'->>'delegacao' IS NOT NULL`);
 add('delegated-documents','Delegação','Registros emitidos com delegação identificada',delegations.rows[0].total,'registros','data.values.delegacao; criação do registro e filtros do proprietário; não inclui textos livres');
 const passcodes=await db.execute(sql`SELECT count(*)::float total FROM module_passcode p JOIN module_record m ON m.id=p.record_id WHERE p.used_at>=${f.from}::date AND p.used_at<(${f.to}::date+interval '1 day') ${f.department?sql`AND m.department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND p.recipient_id=${f.user}::uuid`:sql``} ${f.module?sql`AND m.family=${f.module}`:sql``}`);
 add('passcodes-used','Contrassenha','Contrassenhas utilizadas no período',passcodes.rows[0].total,'usos','module_passcode.used_at; usuário destinatário, setor atual do registro; nenhum token/hash exposto');
 const series=await db.execute(sql`SELECT to_char(d.created_at,'YYYY-MM') AS month,d.type::text AS kind,count(*)::float AS total FROM document d WHERE ${core} GROUP BY 1,2 ORDER BY 1,2`);
 for(const s of series.rows)add(`series-core-${s.month}-${s.kind}`,'Evolução mensal',`${s.month} / ${s.kind}`,s.total,'documentos','document.created_at; mesma população de criação/participação setorial');
 const moduleSeries=await db.execute(sql`SELECT to_char(m.created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS month,m.family,count(*)::float AS total FROM module_record m WHERE ${modules} GROUP BY 1,2 ORDER BY 1,2`);
 for(const s of moduleSeries.rows)add(`series-module-${s.month}-${s.family}`,'Evolução mensal',`${s.month} / ${s.family}`,s.total,'registros','module_record.created_at; setor proprietário e owner; não somar tipos/unidades distintos');
 const times=await db.execute(sql`WITH cohort AS(SELECT m.* FROM module_record m WHERE ${modules}), measured AS (
 SELECT m.*,(SELECT min(a.created_at) FROM audit_log a WHERE a.entity_id=m.id::text AND a.action IN('MODULE_READ','MODULE_EXTERNAL_READ')) first_read,
 (SELECT min(v.created_at) FROM module_version v WHERE v.record_id=m.id AND v.revision>1) first_action,
 (SELECT max(v.created_at) FROM module_version v WHERE v.record_id=m.id AND v.snapshot->>'status' IN('CONCLUIDO','ARQUIVADO','DEFERIDO','INDEFERIDO','PUBLICADO')) closed_at
 FROM cohort m) SELECT family,
 avg(extract(epoch FROM(first_read-created_at))/3600) FILTER(WHERE first_read>=created_at)::float read_hours,
 avg(extract(epoch FROM(first_action-created_at))/3600) FILTER(WHERE first_action>=created_at)::float action_hours,
 avg(extract(epoch FROM(closed_at-created_at))/3600) FILTER(WHERE closed_at>=created_at AND status IN('CONCLUIDO','ARQUIVADO','DEFERIDO','INDEFERIDO','PUBLICADO'))::float closed_hours,
 count(*) FILTER(WHERE status NOT IN('CONCLUIDO','ARQUIVADO','DEFERIDO','INDEFERIDO','PUBLICADO') AND created_at>=now()-interval '20 days')::float open20,
 count(*) FILTER(WHERE status NOT IN('CONCLUIDO','ARQUIVADO','DEFERIDO','INDEFERIDO','PUBLICADO') AND created_at<now()-interval '20 days' AND created_at>=now()-interval '30 days')::float open30,
 count(*) FILTER(WHERE status NOT IN('CONCLUIDO','ARQUIVADO','DEFERIDO','INDEFERIDO','PUBLICADO') AND created_at<now()-interval '30 days')::float open_old FROM measured GROUP BY family`);
 for(const t of times.rows){for(const [key,label] of [['read_hours','primeira leitura'],['action_hours','primeira revisão'],['closed_hours','encerramento registrado']] as const)add(`time-${t.family}-${key}`,'Tempos',`${t.family}: tempo médio até ${label}`,t[key],'horas','Desde criação; primeiro evento de leitura / revisão >1 / última versão final; durações válidas; não usa updated_at como resolução');
 for(const [key,label] of [['open20','até 20 dias'],['open30','mais de 20 até 30 dias'],['open_old','mais de 30 dias']] as const)add(`age-${t.family}-${key}`,'Gargalos',`${t.family}: abertos ${label}`,t[key],'registros','Idade corrente desde criação; intervalos disjuntos; situação atual; mesmo filtro de criação');}
 const staff=await db.execute(sql`WITH population AS(SELECT u.id,u.active,(SELECT max(a.created_at) FROM audit_log a WHERE a.actor_id=u.id::text AND a.created_at<(${f.to}::date+interval '1 day') ${f.module?sql`AND (a.entity_type=${f.module} OR EXISTS(SELECT 1 FROM module_record mm WHERE mm.id::text=a.entity_id AND mm.family=${f.module}))`:sql``}) last_action FROM app_user u WHERE true ${f.department?sql`AND u.department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND u.id=${f.user}::uuid`:sql``} ${f.module?sql`AND EXISTS(SELECT 1 FROM audit_log a WHERE a.actor_id=u.id::text AND a.created_at<(${f.to}::date+interval '1 day') AND (a.entity_type=${f.module} OR EXISTS(SELECT 1 FROM module_record mm WHERE mm.id::text=a.entity_id AND mm.family=${f.module})))`:sql``})
 SELECT count(*)::float total,count(*) FILTER(WHERE active)::float active,count(*) FILTER(WHERE last_action IS NULL)::float never,
 count(*) FILTER(WHERE last_action>=${f.to}::date-interval '2 days')::float days2,
 count(*) FILTER(WHERE last_action<${f.to}::date-interval '2 days' AND last_action>=${f.to}::date-interval '3 days')::float days3,
 count(*) FILTER(WHERE last_action<${f.to}::date-interval '3 days' AND last_action>=${f.to}::date-interval '7 days')::float days7,
 count(*) FILTER(WHERE last_action<${f.to}::date-interval '7 days' AND last_action>=${f.to}::date-interval '14 days')::float days14,
 count(*) FILTER(WHERE last_action<${f.to}::date-interval '14 days' AND last_action>=${f.to}::date-interval '45 days')::float days45,
 count(*) FILTER(WHERE last_action<${f.to}::date-interval '45 days')::float older FROM population`);
 const u=staff.rows[0];add('staff-population','Utilização','Servidores na população selecionada',u.total,'servidores','Lotação atual; usuário opcional; módulo limita aos atores com evento instrumentado até a data final');
 add('staff-active','Utilização','Servidores habilitados na situação atual',u.active,'servidores','app_user.active; mesma população; não presume simultaneidade');
 for(const [key,label] of [['never','sem evento registrado'],['days2','ação até 2 dias'],['days3','ação há mais de 2 até 3 dias'],['days7','ação há mais de 3 até 7 dias'],['days14','ação há mais de 7 até 14 dias'],['days45','ação há mais de 14 até 45 dias'],['older','ação há mais de 45 dias']] as const)add(`activity-${key}`,'Assiduidade digital',`Servidores: ${label}`,u[key],'servidores','Último audit_log até a data final; faixas disjuntas; lotação atual; não é ponto funcional nem prova de login ausente');
 const consumption=await db.execute(sql`SELECT count(*)::float files,avg(a.size)::float mean FROM attachment a JOIN document d ON d.id=a.document_id WHERE ${core}`);
 add('core-file-count','Consumo','Anexos da população documental',consumption.rows[0].files,'arquivos','attachment por documento criado no período; setor de origem ou participação; usuário criador');
 add('core-file-mean','Consumo','Tamanho médio cadastrado dos anexos',consumption.rows[0].mean,'bytes','Média attachment.size não nulo, não média das médias');
 const signatures=await db.execute(sql`SELECT s->>'status' status,count(*)::float total FROM module_record m CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(m.data->'signatures')='array' THEN m.data->'signatures' ELSE '[]'::jsonb END) s WHERE ${modules} GROUP BY s->>'status'`);
 for(const s of signatures.rows)if(['PENDENTE','RECUSADA','CANCELADA'].includes(String(s.status)))add(`signature-${s.status}`,'Assinaturas',`Solicitações de assinatura: ${s.status}`,s.total,'solicitações','module_record.data.signatures; população pela criação; não comprova assinatura criptográfica nem tempo até assinatura');
 const ead=await db.execute(sql`SELECT count(*)::float certificates,avg(p.score)::float score FROM operation_progress p JOIN operation_course c ON c.id=p.course_id JOIN app_user u ON u.id=p.user_id WHERE p.certified_at>=${f.from}::date AND p.certified_at<(${f.to}::date+interval '1 day') ${f.department?sql`AND u.department_id=${f.department}::uuid`:sql``} ${f.user?sql`AND p.user_id=${f.user}::uuid`:sql``} ${f.module?sql`AND c.module=${f.module}`:sql``}`);
 add('ead-certificates','Capacitação','Certificados emitidos no período',ead.rows[0].certificates,'certificados','operation_progress.certified_at; usuário aluno e lotação atual; módulo do curso');
 add('ead-score','Capacitação','Nota média dos certificados emitidos',ead.rows[0].score,'nota de 0 a 100','operation_progress.score; população com certificado no período');
 return rows;
}
