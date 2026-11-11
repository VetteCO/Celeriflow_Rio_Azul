/** End-to-end restore rehearsal: fresh local cluster, isolated files, real Next API and current authorization. */
import assert from "node:assert/strict";
import { randomBytes,createHash } from "node:crypto";
import { mkdirSync,writeFileSync,readFileSync,createWriteStream,renameSync,openSync,closeSync,statSync } from "node:fs";
import { join,resolve } from "node:path";
import { spawn,spawnSync,type ChildProcess } from "node:child_process";
import { Client } from "pg";
import { neon } from "@neondatabase/serverless";
import { firebaseAdminAuth } from "../src/lib/firebase-admin";
import { jsonLines,fileHash } from "../src/lib/operations/stream-export";
const args=process.argv.slice(2);assert.ok(args.includes("--run")&&args.includes("--authorize-full-export"));
const root=resolve(process.env.LOCALAPPDATA!,"Temp/opencode"),out=join(root,`restore-app-${Date.now()}`);mkdirSync(out);
const bin=join(root,"postgresql18/pgsql/bin"),env:NodeJS.ProcessEnv={...process.env,PATH:bin+";"+process.env.PATH};
const sql=neon(process.env.DATABASE_URL!),checks:{assertion:string;outcome:string}[]=[];
const check=(assertion:string,condition:unknown)=>{checks.push({assertion,outcome:condition?"PASS":"FAIL"});writeFileSync(join(out,"results.json"),JSON.stringify({at:new Date().toISOString(),complete:false,checks},null,2));assert.ok(condition,assertion);};
const run=(exe:string,flags:string[],environment:NodeJS.ProcessEnv=env)=>{const log=openSync(join(out,`command-${Date.now()}.private.log`),"wx",0o600);try{const r=spawnSync(exe,flags,{env:environment,stdio:["ignore",log,log],windowsHide:true,timeout:300000});assert.equal(r.status,0,"ISOLATED_COMMAND_FAILED");}finally{closeSync(log);}};
const child=(file:string,flags:string[],environment:NodeJS.ProcessEnv,label:string)=>{const proc=spawn(process.execPath,[file,...flags],{env:environment,windowsHide:true,stdio:["ignore","pipe","pipe"]}),log=createWriteStream(join(out,label+".private.log"));proc.stdout?.pipe(log);proc.stderr?.pipe(log);return proc;};
async function token(uid:string){const custom=await firebaseAdminAuth().createCustomToken(uid),response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:custom,returnSecureToken:true})});const value=await response.json();assert.ok(response.ok&&value.idToken);return value.idToken as string;}
async function main(){
 const [admin]=await sql("SELECT u.id FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND r.name='ADMIN_GERAL' ORDER BY u.id LIMIT 1");assert.ok(admin);env.OPERATIONS_SERVICE_USER_ID=admin.id;
 const startedAt=new Date().toISOString(),backup=join(out,"backup");run(process.execPath,["--import","tsx","--env-file=.env.local","scripts/export-operations.ts",backup,"--authorize-full-export","--with-dump","--preserve-size-discrepancies"]);check("fresh-backup-manifest-and-dump",JSON.parse(readFileSync(join(backup,"manifest.json"),"utf8")).withDump===true);
 const password=randomBytes(32).toString("hex"),pwfile=join(out,"password.private"),data=join(out,"postgres"),database="rio_restore_stage89",port=55449;writeFileSync(pwfile,password,{mode:0o600});
 run(join(bin,"initdb.exe"),["-D",data,"-U","postgres","--auth=scram-sha-256","--pwfile",pwfile,"--encoding=UTF8","--locale=C"]);
 run(join(bin,"pg_ctl.exe"),["-D",data,"-l",join(out,"postgres.private.log"),"-o",`-h 127.0.0.1 -p ${port}`,"-w","start"]);
 const target=`postgresql://postgres:${password}@127.0.0.1:${port}/${database}?sslmode=disable`,pgEnv={...env,PGHOST:"127.0.0.1",PGPORT:String(port),PGUSER:"postgres",PGPASSWORD:password,PGSSLMODE:"disable"};
 let bridge:ChildProcess|undefined,web:ChildProcess|undefined;
 try{
  run(join(bin,"createdb.exe"),[database],pgEnv);const files=join(out,"storage"),restoreEnv={...env,RESTORE_DATABASE_URL:target,RESTORE_DATABASE_NAME:database};run(process.execPath,["--import","tsx","scripts/restore-operations.ts",backup,files,"--confirm-isolated"],restoreEnv);check("database-and-files-restored",JSON.parse(readFileSync(join(files,"restore-result.json"),"utf8")).status==="DATABASE_AND_LOCAL_FILES_VERIFIED");
  const client=new Client({connectionString:target});await client.connect();let remapped=0;
  try{await client.query("BEGIN");await client.query("SET LOCAL session_replication_role='replica'");for await(const mapping of jsonLines(join(files,"storage-map.jsonl"))){const table=String(mapping.table);assert.ok(["attachment","module_file","document_job","operation_report_job"].includes(table));const column=["attachment","module_file"].includes(table)?"storage_key":"output_key",name=String(mapping.localPath).split("/").at(-1)!;assert.match(name,/^[0-9]+\.bin$/);const r=await client.query(`UPDATE ${table} SET ${column}=$1 WHERE id=$2 AND ${column}=$3`,[`restore/${name}`,mapping.id,mapping.storageKey]);assert.equal(r.rowCount,1);assert.equal(await fileHash(join(files,String(mapping.localPath))),mapping.sha256);remapped++;}await client.query("COMMIT");}catch(e){await client.query("ROLLBACK");throw e;}finally{await client.end();}
  check("only-restored-db-storage-keys-remapped",remapped>0);
  const {createServer}=await import("node:net");const availablePort=()=>new Promise<number>((done,fail)=>{const server=createServer();server.once("error",fail);server.listen(0,"127.0.0.1",()=>{const port=(server.address() as {port:number}).port;server.close(error=>error?fail(error):done(port));});});
  const webPort=await availablePort(),bridgePort=await availablePort(),origin=`http://127.0.0.1:${webPort}`;
  const secret=randomBytes(32).toString("hex"),runtime={...env,DATABASE_URL:target,DIRECT_URL:target,RESTORE_DATABASE_NAME:database,RESTORE_SQL_ENDPOINT:`http://127.0.0.1:${bridgePort}/${secret}`,RESTORE_STORAGE_ROOT:files,BLOB_READ_WRITE_TOKEN:"disabled-in-isolated-rehearsal",NEXT_PUBLIC_APP_URL:origin,PORT:String(webPort)};
  writeFileSync(join(out,"runtime.private.json"),JSON.stringify(runtime),{mode:0o600});
  bridge=child("node_modules/tsx/dist/cli.mjs",["scripts/restore-sql-bridge.ts"],runtime,"sql-bridge");web=child("node_modules/next/dist/bin/next",["start","--hostname","127.0.0.1","--port",String(webPort)],runtime,"application");
  let ready=false;for(let attempt=0;attempt<60;attempt++){if(web.exitCode!==null||bridge.exitCode!==null)break;try{const r=await fetch(origin+"/api/health",{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,500));}check("restored-application-http-ready",ready&&web.exitCode===null&&bridge.exitCode===null);
  const attachment=(await sql("SELECT a.id,a.document_id,d.created_by_id,u.firebase_uid FROM attachment a JOIN document d ON d.id=a.document_id JOIN app_user u ON u.id=d.created_by_id WHERE u.active AND u.firebase_uid IS NOT NULL ORDER BY a.id LIMIT 1"))[0];assert.ok(attachment);const bearer=await token(attachment.firebase_uid),headers={authorization:`Bearer ${bearer}`};
  const me=await fetch(origin+"/api/admin/me",{headers});check("restored-application-authenticates-real-session",me.status===200);
  const detail=await fetch(`${origin}/api/documents/${attachment.document_id}`,{headers});check("restored-application-authorizes-original-document",detail.status===200);
  const download=await fetch(`${origin}/api/attachments/${attachment.id}`,{headers:{...headers,"accept-encoding":"identity"}}),bytes=Buffer.from(await download.arrayBuffer());const mappings=[];for await(const row of jsonLines(join(files,"storage-map.jsonl")))mappings.push(row);const mapping=mappings.find(m=>m.table==="attachment"&&m.id===attachment.id)!;
  check("restored-app-download-original-hash",download.ok&&createHash("sha256").update(bytes).digest("hex")===mapping.sha256);
  const declaredSize=download.headers.get("content-length"),actualSize=statSync(join(files,String(mapping.localPath))).size;
  writeFileSync(join(out,"download.json"),JSON.stringify({bytes:bytes.length,isolatedFileBytes:actualSize,contentLength:declaredSize,contentEncoding:download.headers.get("content-encoding"),transferEncoding:download.headers.get("transfer-encoding")},null,2));
  check("restored-app-uses-real-file-size",bytes.length===actualSize&&(declaredSize===null||Number(declaredSize)===bytes.length));
  const anonymous=await fetch(`${origin}/api/attachments/${attachment.id}`);check("restored-application-rejects-anonymous-download",anonymous.status===401);
  const path=join(files,String(mapping.localPath));renameSync(path,path+".missing");try{const missing=await fetch(`${origin}/api/attachments/${attachment.id}`,{headers});check("missing-isolated-file-does-not-fall-back-to-source-blob",missing.status===404);}finally{renameSync(path+".missing",path);}
  const restricted=await sql("SELECT DISTINCT u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND u.firebase_uid IS NOT NULL AND r.name='NIVEL_3_VISUALIZACAO' ORDER BY u.firebase_uid LIMIT 1");assert.ok(restricted[0]);const reader=await token(restricted[0].firebase_uid);const denied=await fetch(origin+"/api/admin/departments",{method:"POST",headers:{authorization:`Bearer ${reader}`,"content-type":"application/json"},body:JSON.stringify({name:"Alteração não autorizada",acronym:"XXXX"})});check("restored-reader-cannot-mutate-administration",denied.status===403);
  const source=await sql("SELECT storage_key FROM attachment WHERE id=$1",[attachment.id]);check("source-storage-key-was-never-remapped",source[0].storage_key===mapping.storageKey);
  writeFileSync(join(out,"results.json"),JSON.stringify({complete:true,status:"RESTORED_APPLICATION_AND_ISOLATED_STORAGE_VERIFIED",startedAt,completedAt:new Date().toISOString(),rtoRehearsalMs:Date.now()-Date.parse(startedAt),remappedOriginals:remapped,checks},null,2));console.log(JSON.stringify({directory:out,passed:checks.length,status:"RESTORED_APPLICATION_AND_ISOLATED_STORAGE_VERIFIED"}));
 }finally{web?.kill();bridge?.kill();run(join(bin,"pg_ctl.exe"),["-D",data,"-m","fast","-w","stop"]);}
}
void main().catch(e=>{writeFileSync(join(out,"failure.private.txt"),String((e as Error).stack??e),{mode:0o600});console.error(JSON.stringify({directory:out,status:"FAILED",passed:checks.filter(c=>c.outcome==="PASS").length}));process.exitCode=1;});
