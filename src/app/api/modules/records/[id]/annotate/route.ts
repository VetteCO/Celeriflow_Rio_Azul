import { createHash, randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { moduleFile } from "@/db/modules-schema";
import { uploadAttachment, downloadAttachment } from "@/lib/blob";
import { context, getRecord, failure, ModuleError } from "@/lib/modules/server";
import { canManage } from "@/lib/modules/policy";
export const dynamic="force-dynamic";
export async function POST(req:Request,{params:paramsPromise}:{params:Promise<{id:string}>}) {
 const params = await paramsPromise;
 let pendingStorage:string|undefined;
 try {
   const ctx=await context(req,"doc:edit");const row=await getRecord(params.id,ctx);if(!canManage(row,ctx)||!["RASCUNHO","EM_ANDAMENTO"].includes(row.status))throw new ModuleError("Registro não permite anotação.",403);
  const p=z.object({revision:z.number().int().positive(),fileId:z.string().uuid(),stamp:z.string().trim().min(3).max(300)}).parse(await req.json());
  const [file]=await db.select().from(moduleFile).where(and(eq(moduleFile.id,p.fileId),eq(moduleFile.recordId,row.id)));
  if(!file||file.mimeType!=="application/pdf")throw new ModuleError("Selecione um PDF original.");
  const blob=await downloadAttachment(file.storageKey);if(!blob)throw new ModuleError("Original indisponível.",404);
   const original=Buffer.from(await new Response(blob.stream).arrayBuffer());if(createHash("sha256").update(original).digest("hex")!==file.sha256)throw new ModuleError("Integridade do original divergente.",409);
   const document=await PDFDocument.load(original);const font=await document.embedFont(StandardFonts.Helvetica);
  const marks=(row.data.measurements??[]).filter(m=>m.fileId===file.id&&m.fileHash===file.sha256&&m.coordinateSystem==="PDF_VIEWPORT_POINTS");
  for(const m of marks) {
   const page=document.getPages()[m.page-1];if(!page)throw new ModuleError("Página da medição inexistente.");
   if(page.getRotation().angle!==0)throw new ModuleError("Normalize a rotação da planta antes de gerar o derivado com medições.");
   const box=page.getCropBox();const points=m.points.map(([x,y])=>({x:box.x+x,y:box.y+box.height-y}));
   const color=rgb(parseInt((m.color??"#d91d48").slice(1,3),16)/255,parseInt((m.color??"#d91d48").slice(3,5),16)/255,parseInt((m.color??"#d91d48").slice(5,7),16)/255);
   const style={borderColor:color,borderWidth:m.width??2,borderOpacity:m.opacity??0.8};
   if(m.shape==="rectangle"||m.shape==="ellipse") {
    const [a,b]=points;const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),width=Math.abs(a.x-b.x),height=Math.abs(a.y-b.y);
    if(m.shape==="rectangle")page.drawRectangle({x,y,width,height,...style});else page.drawEllipse({x:x+width/2,y:y+height/2,xScale:width/2,yScale:height/2,...style});
   }else {const path=m.type==="area"?[...points,points[0]]:points;for(let i=1;i<path.length;i++)page.drawLine({start:path[i-1],end:path[i],thickness:m.width??2,color,opacity:m.opacity??0.8});}
  }
  for(const page of document.getPages()) page.drawText(`${p.stamp}\nCopia anotada - sem assinatura digital`,{x:20,y:20,size:9,font,maxWidth:Math.max(100,page.getWidth()-40),color:rgb(0.7,0.1,0.1)});
  const bytes=Buffer.from(await document.save());const hash=createHash("sha256").update(bytes).digest("hex");const filename=`anotado-${file.filename}`;const storage=await uploadAttachment(`${randomUUID()}-${filename}`,bytes);pendingStorage=storage;
  const result=await db.execute(sql`WITH changed AS (UPDATE module_record SET revision=revision+1,actor_id=${ctx.user.id}::uuid,external_actor_uid=NULL,action='PDF_DERIVADO',note=${`Original ${file.id}; SHA256 ${file.sha256}`}
   WHERE id=${row.id}::uuid AND revision=${p.revision} AND status<>'PUBLICADO' RETURNING id)
   INSERT INTO module_file(record_id,actor_id,filename,category,storage_key,mime_type,size,sha256) SELECT id,${ctx.user.id}::uuid,${filename},'Cópia anotada sem assinatura',${storage},'application/pdf',${bytes.length},${hash} FROM changed RETURNING id`);
  if(!result.rows.length)throw new ModuleError("Registro atualizado. Gere novamente o derivado.",409);
  pendingStorage=undefined;return Response.json({fileId:result.rows[0].id,sha256:hash});
 }catch(e){if(pendingStorage)await del(pendingStorage).catch(()=>{});return failure(e);}
}
