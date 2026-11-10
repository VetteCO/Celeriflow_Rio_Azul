import { createHash, randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { uploadAttachment } from "@/lib/blob";
import { context, admin, getRecord, failure, ModuleError } from "@/lib/modules/server";
export const dynamic="force-dynamic";
export async function POST(req:Request,{params:paramsPromise}:{params:Promise<{id:string}>}) {
 const params = await paramsPromise;
 let pendingStorage:string|undefined;
 try {
  const ctx=await context(req,"doc:edit");admin(ctx);const row=await getRecord(params.id,ctx);
  if(row.family!=="modelos"||row.status==="PUBLICADO")throw new ModuleError("Selecione um modelo editável.");
  const file=(await req.formData()).get("file");
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".docx")||file.size>10*1024*1024)throw new ModuleError("Envie um DOCX de até 10 MB.");
  const bytes=Buffer.from(await file.arrayBuffer());let imageBytes=0;
  const converted=await mammoth.convertToHtml({buffer:bytes},{convertImage:mammoth.images.imgElement(async image=>{
   if(!["image/png","image/jpeg"].includes(image.contentType))throw new ModuleError("Converta imagens do modelo para PNG ou JPEG.");
   const encoded=await image.read("base64");imageBytes+=encoded.length;if(imageBytes>3000000)throw new ModuleError("As imagens do modelo excedem 3 MB.");
   return {src:`data:${image.contentType};base64,${encoded}`};
  })});
  const html=sanitizeHtml(converted.value,{allowedTags:["p","h1","h2","h3","strong","em","u","table","tbody","tr","td","th","img","a","br"],allowedAttributes:{img:["src","alt"],a:["href"]},allowedSchemes:["https","http"],allowedSchemesByTag:{img:["data"]}});
  const storage=await uploadAttachment(`${randomUUID()}-${file.name}`,bytes);pendingStorage=storage;const hash=createHash("sha256").update(bytes).digest("hex");const id=randomUUID();
  await db.execute(sql`WITH original AS (INSERT INTO module_file(id,record_id,actor_id,filename,category,storage_key,mime_type,size,sha256)
   VALUES(${id}::uuid,${row.id}::uuid,${ctx.user.id}::uuid,${file.name},'Modelo DOCX original',${storage},'application/vnd.openxmlformats-officedocument.wordprocessingml.document',${file.size},${hash}) RETURNING id)
   INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
   SELECT 'USER',${ctx.user.id},'MODULE_DOCX_IMPORTED','module_record',${row.id},jsonb_build_object('fileId',id,'sha256',${hash}::text) FROM original`);
  pendingStorage=undefined;return Response.json({html,fileId:id,sha256:hash,filename:file.name,warnings:converted.messages.map(m=>m.message)});
 }catch(e){if(pendingStorage)await del(pendingStorage).catch(()=>{});return failure(e);}
}
