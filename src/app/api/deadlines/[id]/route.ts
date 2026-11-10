import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documentDeadline, auditLog, documentMovement } from "@/db/schema";
import { coreWriteGuard, coreWriteLock, isCoreWriteConflict } from "@/lib/core-write-guard";
import { getSession, requirePerm, canAccessDocument, canActInAnyDepartment } from "@/lib/auth";
const Schema = z.object({ title: z.string().min(1).max(200).optional(), dueAt: z.string().datetime().optional(), status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional() });
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const check = requirePerm(await getSession(req), "doc:edit");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const b = Schema.safeParse(await req.json().catch(() => null));
  if (!b.success || !Object.keys(b.data).length) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const [deadline] = await db.select().from(documentDeadline).where(eq(documentDeadline.id, params.id));
  if (!deadline || !await canAccessDocument(check.session, deadline.documentId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
   if (!await canActInAnyDepartment(check.session, deadline.documentId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try { await db.batch([coreWriteLock(), coreWriteGuard(check.session.userId, "doc:edit", deadline.documentId, null, true),
    db.update(documentDeadline).set({ ...b.data, dueAt: b.data.dueAt ? new Date(b.data.dueAt) : undefined }).where(eq(documentDeadline.id, deadline.id)), db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "DEADLINE_UPDATED", entityType: "document_deadline", entityId: deadline.id, metadata: { before: deadline, after: b.data } }),
    db.insert(documentMovement).values({ documentId: deadline.documentId, action: "DEADLINE_UPDATED", fromDepartmentId: check.session.departmentId, actorUserId: check.session.userId, visibility: "INTERNAL", note: JSON.stringify({ deadlineId: deadline.id, before: { title: deadline.title, dueAt: deadline.dueAt, status: deadline.status }, after: b.data }) })]);
  } catch (error) { if (isCoreWriteConflict(error)) return NextResponse.json({ error: "authorization_changed" }, { status: 409 }); throw error; }
  return NextResponse.json({ ok: true });
}
