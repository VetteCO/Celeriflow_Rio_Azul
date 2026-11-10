import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { moduleFile } from "@/db/modules-schema";
import { downloadAttachment } from "@/lib/blob";
import { externalSession, ownedRecord, externalAudit, externalFileVisibility } from "@/lib/modules/external";
import { failure, ModuleError } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string; fileId: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await externalSession(req); const row = await ownedRecord(params.id, session);
    const [file] = await db.select().from(moduleFile).where(and(eq(moduleFile.id, params.fileId), eq(moduleFile.recordId, params.id), eq(moduleFile.externalVisible, true), externalFileVisibility(row)));
    if (!file) throw new ModuleError("Arquivo não disponível ao interessado.", 404);
    const blob = await downloadAttachment(file.storageKey); if (!blob) throw new ModuleError("Arquivo indisponível.", 404);
    await externalAudit(session, "MODULE_EXTERNAL_DOWNLOAD", params.id, { fileId: file.id });
    return new Response(blob.stream, { headers: { "content-type": file.mimeType, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (e) { return failure(e); }
}
