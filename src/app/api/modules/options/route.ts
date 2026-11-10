import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { department, appUser, document } from "@/db/schema";
import { moduleRecord } from "@/db/modules-schema";
import { context, failure, scope } from "@/lib/modules/server";
import { documentScope, requirePerm } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const ctx = await context(req);
    const [departments, users, records, configurations, coreDocuments] = await Promise.all([
      db.select({ id: department.id, name: department.name }).from(department).where(eq(department.active, true)).orderBy(asc(department.name)),
      db.select({ id: appUser.id, name: appUser.name }).from(appUser).where(eq(appUser.active, true)).orderBy(asc(appUser.name)),
      db.select({ id: moduleRecord.id, code: moduleRecord.code, title: moduleRecord.title, family: moduleRecord.family }).from(moduleRecord).where(scope(ctx)).orderBy(asc(moduleRecord.code)),
      db.select().from(moduleRecord).where(and(inArray(moduleRecord.family, ["fluxos", "modelos", "classificacao"]), eq(moduleRecord.status, "ATIVO"))),
      db.select({ id: document.id, subject: document.subject, number: document.number, year: document.year }).from(document).where(documentScope(ctx.session)).orderBy(asc(document.createdAt)),
    ]);
    return Response.json({ departments, users, records, configurations, coreDocuments, userId: ctx.user.id, departmentId: ctx.user.departmentId, departmentIds: ctx.session.departmentIds, canCreate: requirePerm(ctx.session, "doc:create").ok, admin: ctx.session.roles.includes("ADMIN_GERAL") });
  } catch (e) { return failure(e); }
}
