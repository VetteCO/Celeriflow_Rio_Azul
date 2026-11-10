import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { uploadAttachment } from "@/lib/blob";
import { admin, context, failure, getRecord, ModuleError } from "@/lib/modules/server";
import { configFamilies, type Family } from "@/lib/modules/domain";
import { canManage } from "@/lib/modules/policy";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  let storageKey: string | undefined;
  try {
    const ctx = await context(req, "doc:edit"); const row = await getRecord(params.id, ctx);
    if (configFamilies.includes(row.family as Family)) admin(ctx);
    else if (!canManage(row, ctx)) throw new ModuleError("Sem permissão para anexar a este registro.", 403);
    if (!["RASCUNHO", "EM_ANDAMENTO"].includes(row.status)) throw new ModuleError("O registro não aceita anexos nesta situação.");
    const form = await req.formData(); const file = form.get("file"); const category = String(form.get("category") ?? "Anexo").slice(0, 200);
    const externalVisible = form.get("externalVisible") === "true";
    if (!(file instanceof File) || file.size <= 0 || file.size > 10 * 1024 * 1024) throw new ModuleError("Selecione arquivo de até 10 MB.");
    const extension = file.name.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = { pdf: "application/pdf", dwg: "application/acad", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain", csv: "text/csv", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    if (!extension || !types[extension]) throw new ModuleError("Formato não permitido.");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (extension === "pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") throw new ModuleError("Conteúdo PDF inválido.");
    storageKey = await uploadAttachment(`${randomUUID()}-${file.name}`, bytes);
    const id = randomUUID(); const digest = createHash("sha256").update(bytes).digest("hex");
    // A single SQL statement ties attachment insertion to optimistic revision update.
    const result = await db.execute(sql`WITH changed AS (
      UPDATE module_record SET revision=revision+1, actor_id=${ctx.user.id}::uuid, external_actor_uid=NULL, action='ANEXO_ADICIONADO', note=${file.name}
      WHERE id=${row.id}::uuid AND revision=${row.revision} AND status IN ('RASCUNHO','EM_ANDAMENTO') RETURNING id
    ) INSERT INTO module_file(id,record_id,actor_id,filename,category,storage_key,mime_type,size,sha256,external_visible)
    SELECT ${id}::uuid,id,${ctx.user.id}::uuid,${file.name},${category},${storageKey},${types[extension]},${file.size},${digest},${externalVisible} FROM changed RETURNING id`);
    if (!result.rows.length) throw new ModuleError("Registro alterado durante o envio. Recarregue e tente novamente.", 409);
    storageKey = undefined;
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    if (storageKey) await del(storageKey).catch(error => console.error("[modules] cleanup", error));
    return failure(e);
  }
}
