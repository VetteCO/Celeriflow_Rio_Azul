import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { downloadAttachment } from "@/lib/blob";
import { actor, failure, download, OperationError } from "@/lib/operations/server";
import { zip } from "@/lib/operations/formats";
export const dynamic="force-dynamic";
export const maxDuration=60;
// This bounded synchronous path fails explicitly instead of silently omitting originals.
const MAX_BYTES=64*1024*1024;
export async function POST(req:Request){try{
 const {user}=await actor(req,"operations:export");
 const tables=await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
 const names=tables.rows.map(r=>String(r.tablename));
 const queries=names.map(name=>sql`SELECT ${name}::text AS name, coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) AS records FROM ${sql.identifier(name)} t`);
 if(!queries.length)throw new OperationError(409,"Nenhuma tabela disponível.");
 // All table data in one statement: one PostgreSQL MVCC statement snapshot.
 const snapshot=await db.execute(sql.join(queries,sql` UNION ALL `));
 const data=Object.fromEntries(snapshot.rows.map(r=>[String(r.name),r.records]));
 const files:{name:string;data:Buffer}[]=[{name:"database.json",data:Buffer.from(JSON.stringify({version:1,exportedAt:new Date().toISOString(),tables:data},null,2))}];
 let bytes=files[0].data.length;
 if(bytes>MAX_BYTES)throw new OperationError(413,"Base excede o limite de exportação web. Execute o procedimento de exportação em worker descrito no manual de operação.");
 const originals=[...((data.attachment??[]) as object[]),...((data.module_file??[]) as object[])] as {id:string;filename:string;storage_key:string;size:number|null;sha256?:string}[];
 const manifest:{id:string;filename:string;storageKey:string;path:string;bytes:number;sha256:string}[]=[];
 for(const original of originals){
   if(original.size&&bytes+original.size>MAX_BYTES)throw new OperationError(413,"Anexos excedem 64 MiB. Use o procedimento de exportação integral fora da requisição web.");
   const blob=await downloadAttachment(original.storage_key);
   if(!blob)throw new OperationError(502,`Original indisponível: ${original.id}. A exportação não foi concluída.`);
   const reader=blob.stream.getReader();const chunks:Buffer[]=[];let size=0;
   try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;bytes+=next.value.length;if(bytes>MAX_BYTES){await reader.cancel();throw new OperationError(413,"Exportação excede 64 MiB; execute fora da requisição web.");}chunks.push(Buffer.from(next.value));}}finally{reader.releaseLock();}
   const buffer=Buffer.concat(chunks),path=`originals/${original.id}/${original.filename.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
   if(original.sha256&&createHash("sha256").update(buffer).digest("hex")!==original.sha256)throw new OperationError(502,`Integridade divergente: ${original.id}. A exportação não foi concluída.`);
   files.push({name:path,data:buffer});manifest.push({id:original.id,filename:original.filename,storageKey:original.storage_key,path,bytes:size,sha256:createHash("sha256").update(buffer).digest("hex")});
 }
 files.push({name:"manifest.json",data:Buffer.from(JSON.stringify({databaseSha256:createHash("sha256").update(files[0].data).digest("hex"),originals:manifest,scope:"Todas as tabelas public e originais referenciados em attachment e module_file. Novos armazenamentos exigem revisão do inventário."},null,2))});
 await db.insert(auditLog).values({actorType:"USER",actorId:user.id,action:"OPERATIONS_FULL_EXPORT",entityType:"database",metadata:{tables:names,originals:manifest.length,bytes}});
 return download(zip(files),"application/zip",`exportacao-${new Date().toISOString().slice(0,10)}.zip`);
}catch(e){return failure(e);}}
