/** Run with: npx tsx --env-file=.env.local src/lib/operations/backup-worker.ts <new-directory>
 * Requires pg_dump on PATH; intended for a scheduled, protected operational runner.
 */
import { mkdir,writeFile } from "node:fs/promises";
import { createWriteStream,createReadStream } from "node:fs";
import { resolve,join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable,Transform } from "node:stream";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { downloadAttachment } from "@/lib/blob";
async function hashFile(path:string){const hash=createHash("sha256");for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest("hex");}
async function main(){
 const arg=process.argv[2];if(!arg||!process.env.DATABASE_URL)throw new Error("Informe diretório novo e DATABASE_URL no ambiente protegido.");
 const out=resolve(arg);await mkdir(out,{recursive:false});
 const dump=join(out,"database.dump");
 await new Promise<void>((resolve,reject)=>{const child=spawn("pg_dump",["--format=custom","--no-owner","--no-acl",`--file=${dump}`],{env:{...process.env,PGDATABASE:process.env.DATABASE_URL},stdio:["ignore","ignore","pipe"]});let error="";child.stderr.on("data",d=>{error+=String(d);});child.on("error",reject);child.on("close",code=>code===0?resolve():reject(new Error(`pg_dump falhou (${code}): ${error}`)));});
 const tables=await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
 const snapshot=await db.execute(sql.join(tables.rows.map(r=>sql`SELECT ${String(r.tablename)}::text AS name,coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) AS records FROM ${sql.identifier(String(r.tablename))} t`),sql` UNION ALL `));
 const data=Object.fromEntries(snapshot.rows.map(r=>[String(r.name),r.records]));
 await writeFile(join(out,"database.json"),JSON.stringify({version:1,exportedAt:new Date().toISOString(),tables:data}));
 const files=[...((data.attachment??[])as object[]),...((data.module_file??[])as object[])]as {id:string;storage_key:string;filename:string;sha256?:string}[];
 const originals=[];
 await mkdir(join(out,"originals"));
 for(const f of files){const blob=await downloadAttachment(f.storage_key);if(!blob)throw new Error(`Original indisponível: ${f.id}`);const hash=createHash("sha256");let bytes=0;
 const name=`${f.id}-${f.filename.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
 await pipeline(Readable.fromWeb(blob.stream as never),new Transform({transform(chunk,_,callback){hash.update(chunk);bytes+=chunk.length;callback(null,chunk);}}),createWriteStream(join(out,"originals",name),{flags:"wx"}));
 const sha256=hash.digest("hex");if(f.sha256&&f.sha256!==sha256)throw new Error(`Hash divergente: ${f.id}`);
 originals.push({id:f.id,storageKey:f.storage_key,filename:f.filename,path:`originals/${name}`,bytes,sha256});}
 await writeFile(join(out,"manifest.json"),JSON.stringify({completedAt:new Date().toISOString(),databaseDumpSha256:await hashFile(dump),databaseJsonSha256:await hashFile(join(out,"database.json")),originals},null,2),{flag:"wx"});
 console.log(`Backup concluído: ${out}; ${originals.length} originais. Valide e replique conforme a política institucional.`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
