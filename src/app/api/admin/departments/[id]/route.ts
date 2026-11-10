import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { department, auditLog, appUser, userDepartment } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { administrationLock, administrationGuard, isAdministrationConflict, managedDepartmentIds } from "@/lib/user-administration";
import { requestContext } from "@/lib/profile-validation";
const Schema = z.object({ name: z.string().min(2).max(200).optional(), acronym: z.string().max(30).optional(), parentId: z.string().uuid().nullable().optional(), active: z.boolean().optional(), reallocateToDepartmentId: z.string().uuid().optional() });
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const check = requirePerm(await getSession(req), "admin:departments");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const global = check.session.roles.includes("ADMIN_GERAL");
  if (!global && !(await managedDepartmentIds(check.session)).includes(params.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const b = parsed.data, all = await db.select().from(department), current = all.find(d => d.id === params.id);
  if (!global && (b.active !== undefined || b.reallocateToDepartmentId || b.parentId !== undefined && b.parentId !== current?.parentId)) return NextResponse.json({ error: "global_admin_required" }, { status: 403 });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const descendants = new Set([current.id]); let more = true;
  while (more) { more = false; for (const d of all) if (d.parentId && descendants.has(d.parentId) && !descendants.has(d.id)) { descendants.add(d.id); more = true; } }
  if (b.parentId && (descendants.has(b.parentId) || !all.some(d => d.id === b.parentId && d.active))) return NextResponse.json({ error: "invalid_parent_cycle" }, { status: 400 });
  const destination = b.reallocateToDepartmentId;
  if (b.active === false && (!destination || descendants.has(destination) || !all.some(d => d.id === destination && d.active))) return NextResponse.json({ error: "active_reallocation_required" }, { status: 409 });
  if (b.active === false && all.some(d => d.parentId === current.id && d.active)) return NextResponse.json({ error: "reallocate_subdepartments_first" }, { status: 409 });
  const { reallocateToDepartmentId: _, ...values } = b;
  try { await db.batch([
    administrationLock(),
    administrationGuard(check.session.userId, check.session.userId, global ? [] : [current.id], null, global, true),
    db.execute(sql`WITH RECURSIVE descendants(id) AS (SELECT id FROM department WHERE id=${current.id}::uuid UNION SELECT d.id FROM department d JOIN descendants s ON d.parent_id=s.id)
      SELECT 1 / CASE WHEN (${b.parentId ?? null}::uuid IS NULL OR NOT EXISTS(SELECT 1 FROM descendants WHERE id=${b.parentId ?? null}::uuid))
      AND (${b.active !== false} OR NOT EXISTS(SELECT 1 FROM department WHERE parent_id=${current.id}::uuid AND active))
      AND (${destination ?? null}::uuid IS NULL OR EXISTS(SELECT 1 FROM department WHERE id=${destination ?? null}::uuid AND active AND id NOT IN(SELECT id FROM descendants))) THEN 1 ELSE 0 END`),
    db.update(department).set({ ...values, name: values.name ?? current.name }).where(eq(department.id, current.id)),
    db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "DEPARTMENT_UPDATED", entityType: "department", entityId: current.id, metadata: { before: current, after: b, ...requestContext(req) } }),
    ...(b.active === false && destination ? [
      db.update(appUser).set({ departmentId: destination }).where(eq(appUser.departmentId, current.id)),
      db.execute(sql`INSERT INTO user_department(user_id,department_id) SELECT user_id,${destination}::uuid FROM user_department WHERE department_id=${current.id}::uuid ON CONFLICT DO NOTHING`),
      db.delete(userDepartment).where(eq(userDepartment.departmentId, current.id)),
      // Transfer open work without rewriting historical sector IDs.
      db.execute(sql`INSERT INTO document_participation(document_id,department_id,state) SELECT document_id,${destination}::uuid,'PENDING' FROM document_participation WHERE department_id=${current.id}::uuid AND state IN ('OPEN','PENDING') ON CONFLICT(document_id,department_id) DO UPDATE SET state='PENDING',updated_at=now()`),
      db.execute(sql`INSERT INTO document_movement(document_id,from_department_id,to_department_id,action,actor_user_id) SELECT document_id,${current.id}::uuid,${destination}::uuid,'SECTOR_REALLOCATED',${check.session.userId}::uuid FROM document_participation WHERE department_id=${current.id}::uuid AND state IN ('OPEN','PENDING')`),
      db.execute(sql`UPDATE document_participation SET state='FORWARDED',updated_at=now() WHERE department_id=${current.id}::uuid AND state IN ('OPEN','PENDING')`),
    ] : []),
  ]); } catch (error) { if (isAdministrationConflict(error)) return NextResponse.json({ error: "authorization_changed" }, { status: 409 }); throw error; }
  return NextResponse.json({ ok: true });
}
