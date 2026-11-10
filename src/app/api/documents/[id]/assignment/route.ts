import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { canAccessDocument, getSession, requirePerm } from "@/lib/auth";
import { coreWriteGuard, coreWriteLock, isCoreWriteConflict } from "@/lib/core-write-guard";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = requirePerm(await getSession(req), "doc:view");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const doc = await canAccessDocument(check.session, id);
  if (!doc || doc.type !== "EXTERNAL_REQUEST") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const users = await db.execute(sql`SELECT DISTINCT u.id,u.name FROM app_user u JOIN document_participation p ON p.document_id=${id}::uuid
    AND (p.department_id=u.department_id OR EXISTS(SELECT 1 FROM user_department ud WHERE ud.user_id=u.id AND ud.department_id=p.department_id))
    JOIN department d ON d.id=p.department_id AND d.active WHERE u.active AND p.state IN('OPEN','PENDING') ORDER BY u.name,u.id`);
  return NextResponse.json({ assigneeId: doc.assigneeId, users: users.rows });
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = requirePerm(await getSession(req), "doc:edit");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const doc = await canAccessDocument(check.session, id);
  if (!doc || doc.type !== "EXTERNAL_REQUEST") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const b = z.object({ assigneeId: z.string().uuid().nullable(), departmentId: z.string().uuid().optional() }).safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  try {
    await db.batch([coreWriteLock(), coreWriteGuard(check.session.userId, "doc:edit", id, b.data.departmentId ?? null, true), db.execute(sql`SELECT id FROM document WHERE id=${id}::uuid FOR UPDATE`),
      db.execute(sql`SELECT 1/count(*)::int FROM document d WHERE d.id=${id}::uuid AND d.status IN('OPEN','IN_TRANSIT') AND (${b.data.assigneeId}::uuid IS NULL OR EXISTS(
        SELECT 1 FROM app_user u JOIN document_participation p ON p.document_id=d.id AND p.state IN('OPEN','PENDING') JOIN department s ON s.id=p.department_id AND s.active
        WHERE u.id=${b.data.assigneeId}::uuid AND u.active AND (u.department_id=p.department_id OR EXISTS(SELECT 1 FROM user_department ud WHERE ud.user_id=u.id AND ud.department_id=p.department_id))))`),
      db.execute(sql`WITH changed AS (UPDATE document SET assignee_id=${b.data.assigneeId}::uuid WHERE id=${id}::uuid AND assignee_id IS DISTINCT FROM ${b.data.assigneeId}::uuid RETURNING id)
        INSERT INTO document_movement(document_id,action,note,actor_user_id,visibility) SELECT id,'ASSIGNEE_UPDATED',coalesce((SELECT name FROM app_user WHERE id=${b.data.assigneeId}::uuid),'Sem responsável individual'),${check.session.userId}::uuid,'INTERNAL' FROM changed`),
      db.execute(sql`INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES('USER',${check.session.userId},'REQUEST_ASSIGNED','document',${id},jsonb_build_object('assigneeId',${b.data.assigneeId}::text,'notificationStatus','INTERNAL_EVENT_RECORDED'))`)]);
    return NextResponse.json({ ok: true });
  } catch (error) { if (isCoreWriteConflict(error)) return NextResponse.json({ error: "assignment_changed_or_invalid" }, { status: 409 }); throw error; }
}
