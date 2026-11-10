import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { moduleRecord } from "@/db/modules-schema";
import { context, failure, scope } from "@/lib/modules/server";
import { familySchema, familyFields } from "@/lib/modules/domain";
import { csv } from "@/lib/modules/formats";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ family: string }> }) {
  const params = await paramsPromise;
  try {
    const ctx = await context(req); const family = familySchema.parse(params.family);
    const records = await db.select().from(moduleRecord).where(and(eq(moduleRecord.family, family), scope(ctx))).orderBy(asc(moduleRecord.code));
    const fields = familyFields[family] ?? [];
    const rows = [["Código", "Título", "Situação", "Revisão", ...fields.map(f => f.label)], ...records.map(r => [r.code, r.title, r.status, String(r.revision), ...fields.map(f => r.data.values?.[f.key] ?? "")])];
    return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${family}.csv"`, "cache-control": "private, no-store" } });
  } catch (e) { return failure(e); }
}
