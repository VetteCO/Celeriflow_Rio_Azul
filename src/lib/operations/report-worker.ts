import { Client,neonConfig } from '@neondatabase/serverless';
import { randomUUID,createHash } from 'node:crypto';
import { put,del } from '@vercel/blob';
import { report,reportFilters } from './reports';
import { historicalReports } from './historical-reports';
import { inSnapshot } from './query';
import { csv,pdf,xlsx } from './formats';
import { can,type Role } from '@/lib/rbac';
neonConfig.webSocketConstructor=globalThis.WebSocket;
export async function reportWorkerOnce(jobId?:string,onStage?:(stage:string,elapsedMs:number)=>void){
 if(jobId&&!/^[0-9a-f-]{36}$/i.test(jobId))throw new Error('Identificador de relatório inválido.');
 if(!process.env.DATABASE_URL||!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('Configure DATABASE_URL e BLOB_READ_WRITE_TOKEN no executor.');
 const blobOptions={token:process.env.BLOB_READ_WRITE_TOKEN.trim().replace(/^"|"$/g,'')};
 const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:30000,query_timeout:65000,statement_timeout:60000});await client.connect();const lease=randomUUID();let id:string|undefined,uploaded:string|undefined;let stage='CLAIM',stageStarted=Date.now();
 const step=(next:string)=>{onStage?.(stage,Date.now()-stageStarted);stage=next;stageStarted=Date.now();};
 try{
 if(!jobId){await client.query(`WITH ranked AS(SELECT id,row_number() OVER(PARTITION BY owner_id ORDER BY completed_at DESC,id DESC) n FROM operation_report_job WHERE status='READY') UPDATE operation_report_job j SET status='EXPIRED' FROM ranked r WHERE j.id=r.id AND (j.expires_at<=now() OR r.n>5)`);
 const expired=await client.query(`SELECT id,output_key FROM operation_report_job WHERE status='EXPIRED' AND output_key IS NOT NULL`);
 for(const row of expired.rows){await del(row.output_key,{...blobOptions,abortSignal:AbortSignal.timeout(30000)});await client.query(`UPDATE operation_report_job SET output_key=NULL WHERE id=$1 AND status='EXPIRED'`,[row.id]);}
 }
 const claimed=await client.query(`WITH candidate AS(SELECT id FROM operation_report_job WHERE (status='QUEUED' OR(status='RUNNING' AND lease_until<now())) AND attempts<3 AND ($2::uuid IS NULL OR id=$2::uuid) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE operation_report_job j SET status='RUNNING',attempts=attempts+1,lease_token=$1,lease_until=now()+interval '30 minutes',error=NULL FROM candidate c WHERE j.id=c.id RETURNING j.*`,[lease,jobId||null]);
 await client.query(`UPDATE operation_report_job SET status='FAILED',error='Limite de tentativas atingido após interrupção do executor.' WHERE status='RUNNING' AND lease_until<now() AND attempts>=3 AND ($1::uuid IS NULL OR id=$1::uuid)`,[jobId||null]);
 const job=claimed.rows[0];if(!job)return {worked:false};id=job.id;
 step('AUTHORIZE');const roles=await client.query(`SELECT r.name FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.id=$1 AND u.active`,[job.owner_id]);if(!roles.rows.some(r=>can(r.name as Role,'operations:reports')))throw new Error('Permissão do solicitante revogada.');
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 step('SNAPSHOT');const filters=reportFilters.parse(job.filters);const rows=await inSnapshot((text,values)=>client.query(text,values),async()=>[...await report(filters),...await historicalReports(filters)]);
 const snapshot={filters,ownerId:job.owner_id,generatedAt:new Date().toISOString(),rows,consistency:'PostgreSQL REPEATABLE READ; métricas catálogo medidas anteriormente, com cobertura explícita'};
 await client.query('COMMIT');
 step('RENDER');const matrix:(string|number)[][]=[['Categoria','Indicador','Valor','Unidade','Fonte'],...rows.map(r=>[r.category,r.indicator,r.value,r.unit,r.source])];
 const buffer=job.format==='csv'?Buffer.from(csv(matrix)):job.format==='xlsx'?xlsx(matrix):pdf([`Relatório: ${filters.from} a ${filters.to}`,JSON.stringify(filters),...matrix.map(r=>r.join(' | '))]);
 step('UPLOAD');const blob=await put(`operations/reports/${job.owner_id}/${job.id}/${lease}.${job.format}`,buffer,{access:'private',addRandomSuffix:false,...blobOptions,abortSignal:AbortSignal.timeout(60000)});uploaded=blob.pathname;
 step('PUBLISH');await client.query('BEGIN');await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[job.owner_id]);
 const saved=await client.query(`UPDATE operation_report_job SET status='READY',snapshot=$3::jsonb,output_key=$4,output_hash=$5,output_size=$6,completed_at=now(),expires_at=now()+interval '7 days',lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2 AND status='RUNNING' RETURNING id`,[id,lease,JSON.stringify(snapshot),uploaded,createHash('sha256').update(buffer).digest('hex'),buffer.length]);
 if(!saved.rowCount)throw new Error('Lease substituído; resultado não publicado.');
 await client.query(`WITH ranked AS(SELECT id,row_number() OVER(ORDER BY completed_at DESC,id DESC) n FROM operation_report_job WHERE owner_id=$1 AND status='READY') UPDATE operation_report_job j SET status='EXPIRED' FROM ranked r WHERE r.id=j.id AND r.n>5`,[job.owner_id]);
 await client.query(`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('SYSTEM',$1,'OPERATIONS_REPORT_READY','operation_report_job',$2,'{"notification":"available_in_owner_queue"}')`,[job.owner_id,id]);await client.query('COMMIT');uploaded=undefined;step('DONE');return {worked:true,id};
 }catch(error){onStage?.(stage,Date.now()-stageStarted);await client.query('ROLLBACK').catch(()=>{});if(uploaded)await del(uploaded,{...blobOptions,abortSignal:AbortSignal.timeout(30000)}).catch(()=>{});if(id)await client.query(`UPDATE operation_report_job SET status=CASE WHEN attempts<3 THEN 'QUEUED' ELSE 'FAILED' END,error='Geração interrompida; conferir executor, fontes e configurações.',lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2`,[id,lease]);if(error instanceof Error)Object.assign(error,{operationsStage:stage});throw error;}finally{await client.end();}
}
