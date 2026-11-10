import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { department, auditLog } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { managedDepartmentIds, administrationLock, administrationGuard, isAdministrationConflict } from "@/lib/user-administration";
const Schema = z.object({ name: z.string().trim().min(2).max(200), acronym: z.string().max(30).optional(), parentId: z.string().uuid().nullable().optional() });
export async function GET(req: Request) {
  const check = requirePerm(await getSession(req), "doc:view");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const rows = await db.select().from(department);
  return NextResponse.json({ departments: rows, myDepartmentIds: check.session.departmentIds });
}
export async function POST(req: Request) {
  const check = requirePerm(await getSession(req), "admin:departments");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  if (!check.session.roles.includes("ADMIN_GERAL") && (!parsed.data.parentId || !(await managedDepartmentIds(check.session)).includes(parsed.data.parentId))) return NextResponse.json({ error: "managed_parent_required" }, { status: 403 });
  if (parsed.data.parentId) { const [parent] = await db.select().from(department).where(eq(department.id, parsed.data.parentId)); if (!parent?.active) return NextResponse.json({ error: "invalid_parent" }, { status: 400 }); }
  const id = randomUUID();
  try { await db.batch([administrationLock(), administrationGuard(check.session.userId, check.session.userId, parsed.data.parentId ? [parsed.data.parentId] : [], null, !parsed.data.parentId, true), db.insert(department).values({ ...parsed.data, id }), db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "DEPARTMENT_CREATED", entityType: "department", entityId: id, metadata: parsed.data })]); }
  catch (error) { if (isAdministrationConflict(error)) return NextResponse.json({ error: "authorization_changed" }, { status: 409 }); throw error; }
  return NextResponse.json({ id }, { status: 201 });
}
