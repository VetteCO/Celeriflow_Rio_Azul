import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { downloadAttachment } from "@/lib/blob";
import { ModuleError } from "@/lib/modules/server";
import { anonymousFailure,anonymousHeaders,anonymousKey,digest } from "@/lib/modules/anonymous";
export const dynamic="force-dynamic";
export async function POST(req:Request,{params}:{params:Promise<{fileId:string}>}) {
 try {
  const {fileId}=await params;z.string().uuid().parse(fileId);
  const key=anonymousKey.parse(req.headers.get("x-anonymous-key"));
  const result=await db.execute(sql`WITH permitted AS (
   SELECT f.* FROM module_file f JOIN module_anonymous_access a ON a.record_id=f.record_id
   JOIN module_record r ON r.id=f.record_id WHERE f.id=${fileId}::uuid AND f.external_visible=true
   AND a.token_hash=${digest(key)} AND r.family='ouvidoria' AND r.data->'values'->>'modalidade'='Anônima'
  ), audit AS (INSERT INTO audit_log(actor_type,action,entity_type,entity_id,metadata)
   SELECT 'ANONYMOUS','MODULE_ANONYMOUS_DOWNLOAD','module_record',record_id::text,jsonb_build_object('fileId',id) FROM permitted)
  SELECT filename,storage_key,mime_type FROM permitted`);
  const file=result.rows[0];if(!file)throw new ModuleError("Arquivo indisponível.",404);
  const blob=await downloadAttachment(String(file.storage_key));if(!blob)throw new ModuleError("Arquivo indisponível.",404);
  return new Response(blob.stream,{headers:{...anonymousHeaders,"content-type":String(file.mime_type),"content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(String(file.filename))}`,"x-content-type-options":"nosniff"}});
 }catch(e){return anonymousFailure(e);}
}
