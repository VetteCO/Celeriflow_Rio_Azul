import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appUser } from "@/db/schema";
import { moduleRecord } from "@/db/modules-schema";
import { context, failure, getRecord, ModuleError, scope } from "@/lib/modules/server";
import { csv } from "@/lib/modules/formats";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await context(req), url = new URL(req.url);
    const id = z.string().uuid().parse(url.searchParams.get("delegacao"));
    const grant = await getRecord(id, ctx);
    if (grant.family !== "delegacoes" || grant.ownerId !== ctx.user.id && grant.data.values?.digitador !== ctx.user.id) throw new ModuleError("Autorização não encontrada.", 404);
    const records = await db.select({ id: moduleRecord.id, code: moduleRecord.code, title: moduleRecord.title, family: moduleRecord.family, status: moduleRecord.status, createdAt: moduleRecord.createdAt, updatedAt: moduleRecord.updatedAt, typist: appUser.name })
      .from(moduleRecord).leftJoin(appUser, eq(appUser.id, moduleRecord.ownerId))
      .where(and(sql`${moduleRecord.data}->'values'->>'delegacao'=${id}`, scope(ctx))).orderBy(asc(moduleRecord.createdAt), asc(moduleRecord.id));
    const [authorizer] = await db.select({ name: appUser.name }).from(appUser).where(eq(appUser.id, grant.ownerId!));
    const rows = records.map(row => ({ ...row, authorizer: authorizer?.name ?? "Servidor", delegationCode: grant.code }));
    if (url.searchParams.get("format") === "csv") return new Response(csv([["Documento", "Assunto", "Módulo", "Situação", "Autorização", "Autorizador", "Digitador", "Criado em"], ...rows.map(r => [r.code, r.title, r.family, r.status, r.delegationCode, r.authorizer, r.typist ?? "Servidor", r.createdAt.toISOString()])]), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="emissoes-${grant.code}.csv"`, "cache-control": "no-store" } });
    return Response.json({ records: rows, delegation: { code: grant.code, status: grant.status, used: grant.data.values?.usos, limit: grant.data.values?.limite }, note: "A relação contém somente os documentos que sua conta está autorizada a consultar." }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return failure(e); }
}
