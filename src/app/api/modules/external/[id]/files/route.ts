import { randomUUID, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { uploadAttachment } from "@/lib/blob";
import { externalSession, ownedRecord, externalWriteGate } from "@/lib/modules/external";
import { failure, ModuleError } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  let key: string | undefined;
  try {
    const session = await externalSession(req); const row = await ownedRecord(params.id, session, "upload");
    if (!["RASCUNHO", "EM_ANDAMENTO"].includes(row.status)) throw new ModuleError("Atendimento encerrado não recebe novos anexos.");
    const form = await req.formData(); const file = form.get("file"); const category = String(form.get("category") ?? "Anexo").trim().slice(0, 200);
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !category) throw new ModuleError("Envie um arquivo de até 10 MB e informe a categoria.");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime: Record<string, string> = { pdf: "application/pdf", dwg: "application/acad", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain" };
    if (!mime[extension]) throw new ModuleError("Utilize PDF, DWG, PNG, JPEG ou TXT.");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (extension === "pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") throw new ModuleError("PDF inválido.");
    key = await uploadAttachment(`${randomUUID()}-${file.name}`, bytes); const id = randomUUID();
    const result = await db.execute(sql`WITH changed AS (
      UPDATE module_record SET revision=revision+1,actor_id=NULL,external_actor_uid=${session.uid},action='EXTERNO_ANEXO',note=''
      WHERE id=${row.id}::uuid AND revision=${row.revision} AND status IN ('RASCUNHO','EM_ANDAMENTO') AND ${externalWriteGate(row, session, "upload")} RETURNING id
    ) INSERT INTO module_file(id,record_id,filename,category,storage_key,mime_type,size,sha256,external_actor_uid,external_visible)
      SELECT ${id}::uuid,id,${file.name},${category},${key},${mime[extension]},${file.size},${createHash("sha256").update(bytes).digest("hex")},${session.uid},true FROM changed RETURNING id`);
    if (!result.rows.length) throw new ModuleError("Atendimento atualizado ou autorização encerrada. Tente novamente.", 409);
    key = undefined; return Response.json({ id }, { status: 201 });
  } catch (e) { if (key) await del(key).catch(() => {}); return failure(e); }
}
