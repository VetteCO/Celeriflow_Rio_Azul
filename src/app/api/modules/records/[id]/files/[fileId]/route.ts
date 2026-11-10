import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { moduleFile } from "@/db/modules-schema";
import { auditLog } from "@/db/schema";
import { downloadAttachment } from "@/lib/blob";
import { context, failure, getRecord, ModuleError } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string; fileId: string }> }) {
  const params = await paramsPromise;
  try {
    const ctx = await context(req); const row = await getRecord(params.id, ctx);
    const [file] = await db.select().from(moduleFile).where(and(eq(moduleFile.id, params.fileId), eq(moduleFile.recordId, row.id)));
    if (!file) throw new ModuleError("Anexo não encontrado.", 404);
    const blob = await downloadAttachment(file.storageKey);
    if (!blob) throw new ModuleError("Arquivo indisponível.", 404);
    await db.insert(auditLog).values({ actorType: "USER", actorId: ctx.user.id, action: "MODULE_DOWNLOAD", entityType: "module_file", entityId: file.id });
    return new Response(blob.stream, { headers: { "content-type": file.mimeType, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (e) { return failure(e); }
}
