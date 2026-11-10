import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { moduleRecord } from "@/db/modules-schema";
import { failure } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const rows = await db.select().from(moduleRecord).where(and(inArray(moduleRecord.family, ["carta", "camadas", "legislacao"]), eq(moduleRecord.status, "ATIVO"))).orderBy(asc(moduleRecord.title));
    // Explicit allowlist. Internal records, versions, identities and files never cross this boundary.
    return Response.json({ records: rows.filter(r => r.family === "carta" || r.data.values?.publicar === "Sim").map(r => ({ id: r.id, family: r.family, title: r.title, body: r.body, code: r.code, values: r.data.values, geometry: r.family === "camadas" ? r.data.geometry : undefined })) });
  } catch (e) { return failure(e); }
}
