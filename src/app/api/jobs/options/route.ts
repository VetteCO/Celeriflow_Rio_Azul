import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { attachment, document } from "@/db/schema";
import { moduleRecord, moduleFile } from "@/db/modules-schema";
import { documentScope } from "@/lib/auth";
import { scope } from "@/lib/modules/server";
import { authorizeSources, context, failure } from "@/lib/jobs/server";
import { sourceSchema } from "@/lib/jobs/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const ctx = await context(req), params = new URL(req.url).searchParams;
    if (params.has("id")) {
      const ref = sourceSchema.parse({ id: params.get("id"), type: params.get("type") });
      await authorizeSources([ref], ctx);
      const files = ref.type === "document"
        ? await db.select({ id: attachment.id, filename: attachment.filename, mimeType: attachment.mimeType, size: attachment.size }).from(attachment).where(eq(attachment.documentId, ref.id))
        : await db.select({ id: moduleFile.id, filename: moduleFile.filename, mimeType: moduleFile.mimeType, size: moduleFile.size }).from(moduleFile).where(eq(moduleFile.recordId, ref.id));
      return Response.json({ files }, { headers: { "cache-control": "private, no-store" } });
    }
    const search = params.get("q")?.trim().slice(0, 100); const needle = `%${search?.replace(/[\\%_]/g, "\\$&") ?? ""}%`;
    const [documents, records] = await Promise.all([
      db.select({ id: document.id, title: document.subject, code: document.businessCode }).from(document).where(and(documentScope(ctx.session), search ? or(ilike(document.subject, needle), ilike(document.businessCode, needle)) : undefined)).orderBy(desc(document.createdAt), desc(document.id)).limit(101),
      db.select({ id: moduleRecord.id, title: moduleRecord.title, code: moduleRecord.code }).from(moduleRecord).where(and(scope(ctx), search ? or(ilike(moduleRecord.title, needle), ilike(moduleRecord.code, needle)) : undefined)).orderBy(desc(moduleRecord.updatedAt), desc(moduleRecord.id)).limit(101),
    ]);
    return Response.json({ sources: [...documents.slice(0, 100).map(r => ({ ...r, type: "document" })), ...records.slice(0, 100).map(r => ({ ...r, type: "module" }))], limitPerType: 100, truncated: documents.length > 100 || records.length > 100 }, { headers: { "cache-control": "private, no-store" } });
  } catch (e) { return failure(e); }
}
