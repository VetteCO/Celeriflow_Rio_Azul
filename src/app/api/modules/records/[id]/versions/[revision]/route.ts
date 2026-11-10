import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { moduleVersion } from "@/db/modules-schema";
import { context, failure, getRecord, ModuleError } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string; revision: string }> }) {
  const params = await paramsPromise;
  try {
    const ctx = await context(req); const row = await getRecord(params.id, ctx);
    const [version] = await db.select().from(moduleVersion).where(and(eq(moduleVersion.recordId, row.id), eq(moduleVersion.revision, Number(params.revision))));
    if (!version) throw new ModuleError("Versão não encontrada.", 404);
    const snapshot = structuredClone(version.snapshot);
    // Historical identities remain protected even after changes to modality.
    const data = snapshot.data as { identity?: unknown; identityDepartmentId?: string } | undefined;
    if (row.family === "ouvidoria" && data && !ctx.session.departmentIds.includes(data.identityDepartmentId ?? "")) delete data.identity;
    if (row.family === "ouvidoria") { delete snapshot.external_owner_uid; delete snapshot.external_owner_email; delete snapshot.external_actor_uid; }
    return Response.json({ version: { ...version, snapshot } });
  } catch (e) { return failure(e); }
}
