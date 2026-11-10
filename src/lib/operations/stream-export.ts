import { Client, neonConfig } from '@neondatabase/serverless';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, writeFile, rename, stat, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { downloadAttachment } from '@/lib/blob';

neonConfig.webSocketConstructor=globalThis.WebSocket;
export async function fileHash(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export async function* jsonLines(path:string):AsyncGenerator<Record<string,unknown>> {const lines=createInterface({input:createReadStream(path),crlfDelay:Infinity});for await(const line of lines)if(line.trim())yield JSON.parse(line);}
export function pgTool(tool:string,args:string[],url:string){return new Promise<void>((done,fail)=>{
 const connection=new URL(url);const database=decodeURIComponent(connection.pathname.slice(1));
 const env={...process.env,PGHOST:connection.hostname,PGPORT:connection.port||'5432',PGUSER:decodeURIComponent(connection.username),PGPASSWORD:decodeURIComponent(connection.password),PGDATABASE:database,PGSSLMODE:connection.searchParams.get('sslmode')||'require'};
 const command=tool==='pg_restore'?[`--dbname=${database}`,...args]:args;
 const child=spawn(tool,command,{env,stdio:['ignore','ignore','ignore']});child.once('error',()=>fail(new Error(`${tool} indisponível no executor.`)));child.once('close',code=>code===0?done():fail(new Error(`${tool} falhou: código ${code}. Consulte configuração do executor; credenciais não são registradas.`)));});}
const ident=(value:string)=>'"'+value.replace(/"/g,'""')+'"';
type Reference={table:string;id:string;storageKey:string;sha256?:string;size?:number;filename:string};

/** One PostgreSQL repeatable-read snapshot, server cursors and backpressure. Memory bounded by 100 rows or one original chunk. */
export async function streamExport(directory:string,withDump=false){
 const url=process.env.DIRECT_URL??process.env.DATABASE_URL,operator=process.env.OPERATIONS_SERVICE_USER_ID;
 if(!url||!operator||!process.argv.includes('--authorize-full-export'))throw new Error('Exige DATABASE_URL, OPERATIONS_SERVICE_USER_ID e --authorize-full-export explícitos.');
 if(new URL(url).hostname.includes('-pooler'))throw new Error('Configure DIRECT_URL sem pool transacional para preservar o snapshot entre cursores e pg_dump.');
 const client=new Client({connectionString:url});await client.connect();
 const run=randomUUID(),out=resolve(directory);let started=false;
 try{
  const permission=await client.query(`SELECT 1 FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.id=$1::uuid AND u.active AND r.name='ADMIN_GERAL'`,[operator]);
  if(!permission.rowCount)throw new Error('Conta operacional ativa ADMIN_GERAL exigida para exportação integral.');
  await mkdir(out,{recursive:false});await mkdir(join(out,'tables'));await mkdir(join(out,'originals'));
  await client.query(`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('SYSTEM',$1,'OPERATIONS_STREAM_EXPORT_STARTED','operations_export',$2,$3::jsonb)`,[operator,run,JSON.stringify({withDump})]);started=true;
  const log=async(event:string,extra:object={})=>appendFile(join(out,'execution.jsonl'),JSON.stringify({at:new Date().toISOString(),run,operator,event,...extra})+'\n');
  await log('STARTED',{withDump});
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const snapshot=(await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
  const schema={version:2,encoding:'UTF-8',rowFormat:'One complete PostgreSQL row as a JSON object per line (NDJSON)',
   columns:(await client.query(`SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows,
   constraints:(await client.query(`SELECT c.relname AS table_name,con.conname,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY 1,2`)).rows,
   indexes:(await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2`)).rows};
  await writeFile(join(out,'schema.json'),JSON.stringify(schema,null,2),{flag:'wx'});
  const entries=join(out,'files.jsonl');await writeFile(entries,'',{flag:'wx'});
  const register=async(path:string,extra:object={})=>{const full=join(out,path);await appendFile(entries,JSON.stringify({path,bytes:(await stat(full)).size,sha256:await fileHash(full),...extra})+'\n');};
  await register('schema.json');
  // SQL schema preserves sequences, enum types, functions, triggers and other DDL not represented by columns alone.
  await pgTool('pg_dump',['--schema-only','--no-owner','--no-acl',`--snapshot=${snapshot}`,`--file=${join(out,'schema.sql')}`],url);await register('schema.sql');
  if(withDump){await pgTool('pg_dump',['--format=custom','--no-owner','--no-acl',`--snapshot=${snapshot}`,`--file=${join(out,'database.dump')}`],url);await register('database.dump');}
  const tables=(await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows;
  const refs=join(out,'original-references.jsonl');await writeFile(refs,'',{flag:'wx'});
  let tableNumber=0,totalRows=0;
  for(const table of tables){const name=String(table.tablename);const path=`tables/${String(++tableNumber).padStart(4,'0')}.jsonl`;let count=0;
   await client.query(`DECLARE export_cursor NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS row FROM public.${ident(name)} t`);
   async function* records(){while(true){const batch=await client.query('FETCH FORWARD 100 FROM export_cursor');if(!batch.rows.length)break;
    for(const record of batch.rows){const row=JSON.parse(record.row);count++;yield record.row+'\n';
     let ref:Reference|undefined;
     if((name==='attachment'||name==='module_file')&&row.storage_key)ref={table:name,id:row.id,storageKey:row.storage_key,sha256:row.sha256,size:row.size,filename:row.filename};
     if((name==='document_job'||name==='operation_report_job')&&row.output_key)ref={table:name,id:row.id,storageKey:row.output_key,sha256:row.output_hash,size:row.output_size,filename:row.output_name||'artefato'};
     if(ref)await appendFile(refs,JSON.stringify(ref)+'\n');
    }
   }}
   await pipeline(Readable.from(records()),createWriteStream(join(out,path),{flags:'wx'}));await client.query('CLOSE export_cursor');
   totalRows+=count;await register(path,{table:name,rows:count});await log('TABLE',{table:name,rows:count});
  }
  await client.query('COMMIT');await register('original-references.jsonl');
  let originals=0; const discrepancies:{table:string;id:string;recordedBytes:number;actualBytes:number}[]=[];
  for await(const raw of jsonLines(refs)){const ref=raw as unknown as Reference;const blob=await downloadAttachment(ref.storageKey);if(!blob)throw new Error(`Original indisponível: ${ref.table}/${ref.id}. Exportação incompleta.`);
   const path=`originals/${String(++originals).padStart(8,'0')}.bin`;const digest=createHash('sha256');let bytes=0;
   await pipeline(Readable.fromWeb(blob.stream as never),new Transform({transform(chunk,_encoding,cb){digest.update(chunk);bytes+=chunk.length;cb(null,chunk);}}),createWriteStream(join(out,path),{flags:'wx'}));
   const hash=digest.digest('hex');if(ref.sha256&&hash!==ref.sha256)throw new Error(`Hash divergente: ${ref.table}/${ref.id}`);
   if(bytes!==blob.size)throw new Error(`Transferência incompleta: ${ref.table}/${ref.id}`);
   if(ref.size!==undefined&&ref.size!==null&&bytes!==Number(ref.size)) {
    if(!process.argv.includes('--preserve-size-discrepancies'))throw new Error(`Tamanho cadastrado divergente: ${ref.table}/${ref.id}. Revise o original; --preserve-size-discrepancies preserva bytes e registra a divergência no manifesto.`);
    discrepancies.push({table:ref.table,id:ref.id,recordedBytes:Number(ref.size),actualBytes:bytes});
    await log('RECORDED_SIZE_DISCREPANCY',discrepancies.at(-1));
   }
   await register(path,{...ref,kind:'original'});
  }
  await log('FILES_COMPLETE',{tables:tables.length,totalRows,originals});await register('execution.jsonl');
  const manifest={version:2,run,operator,completedAt:new Date().toISOString(),withDump,tables:tables.length,totalRows,originals,discrepancies,files:'files.jsonl',filesSha256:await fileHash(entries),consistency:'PostgreSQL repeatable-read snapshot; originals must remain immutable and retained throughout execution',fileSources:['attachment.storage_key','module_file.storage_key','document_job.output_key','operation_report_job.output_key']};
  await client.query(`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('SYSTEM',$1,'OPERATIONS_STREAM_EXPORT_COMPLETED','operations_export',$2,$3::jsonb)`,[operator,run,JSON.stringify({totalRows,originals,filesSha256:manifest.filesSha256})]);
  await writeFile(join(out,'manifest.partial.json'),JSON.stringify(manifest,null,2),{flag:'wx'});await rename(join(out,'manifest.partial.json'),join(out,'manifest.json'));
  console.log(`Exportação concluída: ${out}; ${tables.length} tabelas, ${totalRows} linhas, ${originals} arquivos. Manifesto v2.`);
 }catch(error){if(started){await client.query('ROLLBACK').catch(()=>{});await appendFile(join(out,'execution.jsonl'),JSON.stringify({at:new Date().toISOString(),run,event:'FAILED'})+'\n').catch(()=>{});await client.query(`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id) VALUES('SYSTEM',$1,'OPERATIONS_STREAM_EXPORT_FAILED','operations_export',$2)`,[operator,run]).catch(()=>{});}throw error;}
 finally{await client.end();}
}
