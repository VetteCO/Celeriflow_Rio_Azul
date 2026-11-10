import { randomUUID,createHash } from "node:crypto";
import { del } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { uploadAttachment } from "@/lib/blob";
import { ModuleError } from "@/lib/modules/server";
import { anonymousFailure,anonymousHeaders,anonymousRecord,anonymousWrite,digest } from "@/lib/modules/anonymous";
export const dynamic="force-dynamic";
export async function POST(req:Request) {
 let storageKey:string|undefined; let persistenceAttempted=false;
 try {
  const key=req.headers.get("x-anonymous-key")??""; const row=await anonymousRecord(key);
  if(Number(req.headers.get("content-length")??0)>6*1024*1024)throw new ModuleError("Limite de 5 MB por arquivo.");
  const reader=req.body?.getReader();if(!reader)throw new ModuleError("Arquivo ausente.");
  const chunks:Uint8Array[]=[];let received=0;
  while(true){const chunk=await reader.read();if(chunk.done)break;received+=chunk.value.byteLength;if(received>6*1024*1024){await reader.cancel();throw new ModuleError("Limite de 5 MB por arquivo.");}chunks.push(chunk.value);}
  const form=await new Response(Buffer.concat(chunks),{headers:{"content-type":req.headers.get("content-type")??""}}).formData();const file=form.get("file");
  const category=z.string().trim().min(1).max(200).parse(form.get("category"));
  const operationId=z.string().uuid().parse(form.get("operationId"));const revision=z.coerce.number().int().positive().parse(form.get("revision"));
  if(!(file instanceof File)||!file.size||file.size>5*1024*1024)throw new ModuleError("Envie PDF, PNG, JPEG ou TXT de até 5 MB.");
  const filename=file.name.replace(/[\x00-\x1f\\/]/g,"_").slice(0,200);const extension=filename.split(".").pop()?.toLowerCase();
  const mime:Record<string,string>={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",txt:"text/plain"};
  if(!extension||!mime[extension])throw new ModuleError("Formato não permitido.");
  const bytes=Buffer.from(await file.arrayBuffer());
  if(extension==="pdf"&&bytes.subarray(0,5).toString()!=="%PDF-"||extension==="png"&&bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||["jpg","jpeg"].includes(extension)&&bytes.subarray(0,3).toString("hex")!=="ffd8ff"||extension==="txt"&&bytes.includes(0))throw new ModuleError("Conteúdo incompatível com o formato.");
  const sha256=createHash("sha256").update(bytes).digest("hex");const fingerprint=digest(JSON.stringify({filename,category,size:file.size,sha256}));
  const prior=await db.execute(sql`SELECT payload_hash,result FROM module_anonymous_operation WHERE record_id=${row.id}::uuid AND operation_id=${operationId}::uuid`);
  if(prior.rows.length){if(prior.rows[0].payload_hash!==fingerprint)throw new ModuleError("Identificador já usado com outro arquivo.",409);return Response.json(prior.rows[0].result,{headers:anonymousHeaders});}
  if(!["RASCUNHO","EM_ANDAMENTO"].includes(row.status))throw new ModuleError("Manifestação encerrada.",409);
  storageKey=await uploadAttachment(`${randomUUID()}-${filename}`,bytes);
  const id=randomUUID();persistenceAttempted=true;const result=await anonymousWrite(key,operationId,revision,"FILE",{id,filename,category,storageKey,mimeType:mime[extension],size:file.size,sha256},fingerprint);
  if(result.fileId!==id)await del(storageKey).catch(()=>{});
  storageKey=undefined;return Response.json(result,{headers:anonymousHeaders});
 }catch(e){
  // An independent read can miss an in-flight COMMIT. Preserve every attempted write for reconciliation.
  if(storageKey&&!persistenceAttempted)await del(storageKey).catch(()=>{});
  return anonymousFailure(e);
 }
}
