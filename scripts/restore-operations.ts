/** Isolated rehearsal only; never uploads files to the source Blob store. */
import { Client, neonConfig } from '@neondatabase/serverless';
import { readFile, mkdir, copyFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileHash, jsonLines, pgTool } from '../src/lib/operations/stream-export';
import { spawn } from 'node:child_process';
neonConfig.webSocketConstructor=globalThis.WebSocket;
async function main(){
 const [input,destination]=process.argv.slice(2);const target=process.env.RESTORE_DATABASE_URL,source=process.env.DATABASE_URL;
 if(!input||!destination||!target||!source||!process.argv.includes('--confirm-isolated'))throw new Error('Uso: restore-operations.ts <backup-v2> <novo-diretório-arquivos> --confirm-isolated; exige DATABASE_URL de origem, RESTORE_DATABASE_URL e RESTORE_DATABASE_NAME.');
 const src=new URL(source),dst=new URL(target);const database=decodeURIComponent(dst.pathname.slice(1));
 if(database!==process.env.RESTORE_DATABASE_NAME||!/(restore|ensaio|test|homolog)/i.test(database))throw new Error('Destino deve ter nome explícito de ensaio/restauração/teste/homologação, confirmado em RESTORE_DATABASE_NAME.');
 if(src.hostname.replace('-pooler','')===dst.hostname.replace('-pooler','')&&src.pathname===dst.pathname)throw new Error('Destino coincide com a origem.');
 const backup=resolve(input),out=resolve(destination);if(out===backup||!relative(backup,out).startsWith('..')&&!isAbsolute(relative(backup,out)))throw new Error('Arquivos restaurados precisam de diretório novo fora do backup.');
 const safe=(path:string)=>{const full=resolve(backup,path),rel=relative(backup,full);if(isAbsolute(rel)||rel.startsWith('..')||!rel)throw new Error('Caminho inválido no manifesto.');return full;};
 const manifest=JSON.parse(await readFile(join(backup,'manifest.json'),'utf8'));
 if(manifest.version!==2||manifest.withDump!==true||manifest.files!=='files.jsonl')throw new Error('Exige backup v2 concluído com dump.');
 if(await fileHash(join(backup,'files.jsonl'))!==manifest.filesSha256)throw new Error('Manifesto de arquivos divergente.');
 let dumpVerified=false,verified=0;
 for await(const entry of jsonLines(join(backup,'files.jsonl'))){const path=safe(String(entry.path));if((await stat(path)).size!==entry.bytes||await fileHash(path)!==entry.sha256)throw new Error(`Integridade inválida: ${entry.path}`);if(entry.path==='database.dump')dumpVerified=true;verified++;}
 if(!dumpVerified)throw new Error('Dump não está no manifesto verificado.');
  // Neon uses WebSockets; an isolated local PostgreSQL uses its native psql client.
  const local=['localhost','127.0.0.1','[::1]'].includes(dst.hostname);
  const client=local?{
   connect:async()=>{},end:async()=>{},
   query:async(query:string):Promise<{rows:Record<string,any>[];rowCount:number}>=>new Promise((done,fail)=>{
    const env={...process.env,PGHOST:dst.hostname,PGPORT:dst.port||'5432',PGUSER:decodeURIComponent(dst.username),PGPASSWORD:decodeURIComponent(dst.password),PGDATABASE:database,PGSSLMODE:dst.searchParams.get('sslmode')||'disable'};
    const child=spawn('psql',['--no-psqlrc','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{env,stdio:['pipe','pipe','pipe']});let output='';
    child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.resume();
    child.once('error',()=>fail(new Error('psql indisponível para o destino local.')));
    child.once('close',code=>{if(code!==0){fail(new Error('Consulta de conferência local falhou.'));return;}try{const rows=output.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));done({rows,rowCount:rows.length});}catch{fail(new Error('Resposta inválida do PostgreSQL local.'));}});
    child.stdin.end(`SELECT row_to_json(result) FROM (${query.replace(/;\s*$/,'')}) result;`);
   })
  }:new Client({connectionString:target});await client.connect();
 const startedAt=new Date().toISOString();let created=false;
 try{
  const actual=(await client.query('SELECT current_database() AS name')).rows[0].name;if(actual!==database)throw new Error('Banco conectado diverge do destino confirmado.');
  const tables=await client.query(`SELECT 1 FROM pg_tables WHERE schemaname NOT IN('pg_catalog','information_schema') LIMIT 1`);if(tables.rowCount)throw new Error('Banco de ensaio deve estar vazio; restauração recusada.');
  await mkdir(out,{recursive:false});created=true;await mkdir(join(out,'originals'));
  await writeFile(join(out,'restore-start.json'),JSON.stringify({startedAt,database,run:manifest.run,verified},null,2),{flag:'wx'});
  await pgTool('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-acl',safe('database.dump')],target);
  let originals=0,tableCount=0;
  // Mapping is streamed so large original inventories do not accumulate in memory.
  const {appendFile}=await import('node:fs/promises');await writeFile(join(out,'storage-map.jsonl'),'');
  for await(const entry of jsonLines(join(backup,'files.jsonl'))){
   if(entry.rows!==undefined){const table=String(entry.table).replace(/"/g,'""');const count=(await client.query(`SELECT count(*)::text n FROM public."${table}"`)).rows[0].n;if(count!==String(entry.rows))throw new Error(`Contagem divergente: ${entry.table}`);tableCount++;}
   if(entry.kind==='original'){const name=String(++originals).padStart(8,'0')+'.bin';const path=join(out,'originals',name);await copyFile(safe(String(entry.path)),path);if(await fileHash(path)!==entry.sha256)throw new Error('Hash divergente após cópia.');await appendFile(join(out,'storage-map.jsonl'),JSON.stringify({table:entry.table,id:entry.id,storageKey:entry.storageKey,localPath:`originals/${name}`,sha256:entry.sha256})+'\n');}
  }
  if(originals!==manifest.originals||tableCount!==manifest.tables)throw new Error('Inventário restaurado diverge do manifesto.');
  const invalid=(await client.query(`SELECT count(*)::int n FROM pg_constraint WHERE contype='f' AND NOT convalidated`)).rows[0].n;
  if(invalid)throw new Error('Há chaves estrangeiras não validadas no banco restaurado; ensaio exige conferência antes de concluir.');
  await writeFile(join(out,'restore-result.json'),JSON.stringify({status:'DATABASE_AND_LOCAL_FILES_VERIFIED',startedAt,completedAt:new Date().toISOString(),database,run:manifest.run,tableCount,originals,unvalidatedForeignKeys:invalid,storageMapSha256:await fileHash(join(out,'storage-map.jsonl')),applicationAcceptance:'PENDING: configurar armazenamento privado isolado e remapear somente o banco de ensaio antes de abrir a aplicação; testar permissões e downloads'},null,2),{flag:'wx'});
  console.log('Banco e arquivos locais restaurados/conferidos. Evidência em restore-result.json; aceite da aplicação permanece pendente.');
 }catch(error){if(created)await writeFile(join(out,'restore-failure.json'),JSON.stringify({startedAt,failedAt:new Date().toISOString(),status:'FAILED'})).catch(()=>{});throw error;}finally{await client.end();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Restauração falhou.');process.exitCode=1;});
