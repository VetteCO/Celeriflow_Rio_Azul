import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { department } from "@/db/schema";
import { canAccessDocument, getSession, requirePerm } from "./auth";

const actionSchema = z.object({ departmentId: z.string().uuid().optional(), toDepartmentId: z.string().uuid().optional(), toDepartmentIds: z.array(z.string().uuid()).max(20).optional(), note: z.string().max(20000).default(""), visibility: z.enum(["INTERNAL", "CITIZEN"]).default("INTERNAL") });
export async function documentAction(req: Request, id: string, action: "forward" | "receive" | "conclude" | "archive" | "reopen" | "reply") {
  const check = requirePerm(await getSession(req), action === "reply" ? "doc:edit" : `doc:${action}`);
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const parsed = actionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const doc = await canAccessDocument(check.session, id);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const b = parsed.data, from = b.departmentId ?? check.session.departmentId;
  if (!from || !check.session.departmentIds.includes(from)) return NextResponse.json({ error: "department_forbidden" }, { status: 403 });
  if (doc.urgency === "INFORMATIVE" && ["forward", "reply"].includes(action)) return NextResponse.json({ error: "informative_circular" }, { status: 409 });
  const targets = Array.from(new Set([b.toDepartmentId, ...(b.toDepartmentIds ?? [])].filter((s): s is string => !!s)));
  if (action === "forward") {
    const active = await db.select().from(department).where(eq(department.active, true));
    if (!targets.length || targets.includes(from) || targets.some(t => !active.some(d => d.id === t))) return NextResponse.json({ error: "invalid_destination" }, { status: 400 });
  }
  const nextState = { forward: "FORWARDED", receive: "OPEN", conclude: "CONCLUDED", archive: "ARCHIVED", reopen: "OPEN", reply: "OPEN" }[action];
  const expected = { forward: ["OPEN"], receive: ["PENDING"], conclude: ["OPEN"], archive: ["CONCLUDED"], reopen: ["CONCLUDED", "ARCHIVED"], reply: ["OPEN"] }[action];
  const event = { forward: "FORWARDED", receive: "RECEIVED", conclude: "CONCLUDED", archive: "ARCHIVED", reopen: "REOPENED", reply: b.visibility === "CITIZEN" ? "CITIZEN_REPLY" : "INTERNAL_NOTE" }[action];
  const targetSql = action === "forward" ? sql`INSERT INTO document_participation(document_id,department_id,state) SELECT ${id}::uuid, t::uuid, 'PENDING' FROM unnest(ARRAY[${sql.join(targets.map(t => sql`${t}`), sql`, `)}]::text[]) t WHERE EXISTS(SELECT 1 FROM changed) ON CONFLICT(document_id,department_id) DO UPDATE SET state='PENDING',updated_at=now() RETURNING department_id` : sql`SELECT ${from}::uuid AS department_id WHERE EXISTS(SELECT 1 FROM changed)`;
  // One SQL statement: row-lock/check state, update sector, open destinations, record events and audit.
  const [, result] = await db.batch([db.execute(sql`SELECT id FROM document WHERE id=${id}::uuid FOR UPDATE`), db.execute(sql`WITH locked AS (SELECT id FROM document WHERE id=${id}::uuid FOR UPDATE), changed AS (
    UPDATE document_participation SET state=${nextState},updated_at=now() WHERE document_id IN(SELECT id FROM locked) AND department_id=${from}::uuid AND state IN (${sql.join(expected.map(s => sql`${s}`), sql`, `)}) RETURNING document_id
  ), targets AS (${targetSql}), population AS (
    SELECT DISTINCT ON(u.id) u.id AS user_id,t.department_id FROM app_user u JOIN targets t
      ON u.department_id=t.department_id OR EXISTS(SELECT 1 FROM user_department ud WHERE ud.user_id=u.id AND ud.department_id=t.department_id)
    WHERE u.active AND ${action}='forward' AND EXISTS(SELECT 1 FROM document d WHERE d.id=${id}::uuid AND d.type='CIRCULAR' AND d.urgency='URGENT') ORDER BY u.id,t.department_id
  ), reactivated AS (
    UPDATE document_recipient r SET recipient_type='TO' FROM population p WHERE r.document_id=${id}::uuid AND r.user_id=p.user_id RETURNING r.user_id
  ), added_recipients AS (
    INSERT INTO document_recipient(document_id,department_id,user_id,recipient_type)
    SELECT ${id}::uuid,p.department_id,p.user_id,'TO' FROM population p WHERE NOT EXISTS(SELECT 1 FROM document_recipient r WHERE r.document_id=${id}::uuid AND r.user_id=p.user_id) RETURNING user_id
  ), moves AS (
    INSERT INTO document_movement(document_id,from_department_id,to_department_id,action,note,visibility,actor_user_id)
    SELECT ${id}::uuid,CASE WHEN ${action}='receive' THEN
      (SELECT m.from_department_id FROM document_movement m WHERE m.document_id=${id}::uuid AND m.to_department_id=${from}::uuid AND m.action IN ('CREATED','FORWARDED','SECTOR_REALLOCATED') ORDER BY m.created_at DESC,m.id DESC LIMIT 1)
      ELSE ${from}::uuid END,department_id,${event},${b.note || null},${b.visibility},${check.session.userId}::uuid FROM targets RETURNING id
  ), status_update AS (
    UPDATE document SET status=CASE WHEN ${action}='forward' THEN 'IN_TRANSIT'::document_status WHEN ${action} IN ('receive','reopen','reply') THEN 'OPEN'::document_status
    WHEN EXISTS(SELECT 1 FROM document_participation p WHERE p.document_id=${id}::uuid AND p.department_id<>${from}::uuid AND p.state IN ('OPEN','PENDING')) THEN 'OPEN'::document_status
    WHEN ${action}='archive' THEN 'ARCHIVED'::document_status ELSE 'CONCLUDED'::document_status END WHERE id IN(SELECT document_id FROM changed) RETURNING id
  ), audit AS (
    INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata) SELECT 'USER',${check.session.userId},${event},'document',${id},jsonb_build_object('departmentId',${from}::text) WHERE EXISTS(SELECT 1 FROM changed)
  ) SELECT id FROM moves`)]);
  if (!result.rows.length) return NextResponse.json({ error: "invalid_sector_transition", expected }, { status: 409 });
  return NextResponse.json({ ok: true, movementId: result.rows[0].id, movementIds: result.rows.map(r => r.id) });
}
