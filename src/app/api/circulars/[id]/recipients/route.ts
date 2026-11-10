import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appUser, department, userDepartment, auditLog, documentParticipation } from "@/db/schema";
import { canAccessDocument, getSession, requirePerm } from "@/lib/auth";
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const check = requirePerm(await getSession(req), "doc:edit");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const doc = await canAccessDocument(check.session, params.id);
  if (!doc || doc.type !== "CIRCULAR") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (doc.createdById !== check.session.userId || !["OPEN", "IN_TRANSIT"].includes(doc.status)) return NextResponse.json({ error: "author_open_circular_required" }, { status: 403 });
  const b = z.object({ departmentIds: z.array(z.string().uuid()).min(1).max(50) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const ids = Array.from(new Set(b.data.departmentIds));
  const sectors = await db.select().from(department).where(and(inArray(department.id, ids), eq(department.active, true)));
  if (sectors.length !== ids.length) return NextResponse.json({ error: "inactive_department" }, { status: 400 });
  const secondary = await db.select().from(userDepartment).where(inArray(userDepartment.departmentId, ids));
  const users = (await db.select().from(appUser).where(eq(appUser.active, true))).filter(u => u.departmentId && ids.includes(u.departmentId) || secondary.some(s => s.userId === u.id));
  if (!users.length) return NextResponse.json({ error: "no_active_recipients" }, { status: 400 });
  await db.batch([
    db.execute(sql`SELECT id FROM document WHERE id=${doc.id}::uuid FOR UPDATE`),
    db.execute(sql`UPDATE document_recipient SET recipient_type='CANCELLED' WHERE document_id=${doc.id}::uuid`),
    ...users.map(u => db.execute(sql`UPDATE document_recipient SET recipient_type='TO' WHERE document_id=${doc.id}::uuid AND user_id=${u.id}::uuid`)),
    ...users.map(u => db.execute(sql`INSERT INTO document_recipient(document_id,department_id,user_id,recipient_type) SELECT ${doc.id}::uuid,${u.departmentId && ids.includes(u.departmentId) ? u.departmentId : secondary.find(s => s.userId === u.id)!.departmentId}::uuid,${u.id}::uuid,'TO' WHERE NOT EXISTS(SELECT 1 FROM document_recipient WHERE document_id=${doc.id}::uuid AND user_id=${u.id}::uuid)`)),
    ...ids.map(departmentId => db.insert(documentParticipation).values({ documentId: doc.id, departmentId, state: "PENDING" }).onConflictDoNothing()),
    db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "CIRCULAR_RECIPIENTS_UPDATED", entityType: "document", entityId: doc.id, metadata: { departmentIds: ids, userIds: users.map(u => u.id) } }),
  ]);
  return NextResponse.json({ ok: true, recipients: users.length });
}
