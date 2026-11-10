import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLog, documentDeadline, documentMovement } from "@/db/schema";
import { coreWriteGuard, coreWriteLock, isCoreWriteConflict } from "@/lib/core-write-guard";
import { getSession, requirePerm, canAccessDocument, canActInAnyDepartment } from "@/lib/auth";
const Schema = z.object({ title: z.string().min(1).max(200), dueAt: z.string().datetime() });
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const check = requirePerm(await getSession(req), "doc:edit");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const doc = await canAccessDocument(check.session, params.id);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
   if (!await canActInAnyDepartment(check.session, doc.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
  const [, , inserted] = await db.batch([coreWriteLock(), coreWriteGuard(check.session.userId, "doc:edit", doc.id, null, true), db.insert(documentDeadline).values({ documentId: doc.id, title: parsed.data.title, dueAt: new Date(parsed.data.dueAt) }).returning(), db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "DEADLINE_ADDED", entityType: "document", entityId: doc.id, metadata: parsed.data }),
    db.insert(documentMovement).values({ documentId: doc.id, fromDepartmentId: check.session.departmentId, action: "DEADLINE_ADDED", note: `${parsed.data.title}: ${parsed.data.dueAt}`, actorUserId: check.session.userId, visibility: "INTERNAL" })]);
  return NextResponse.json({ id: inserted[0].id }, { status: 201 });
  } catch (error) { if (isCoreWriteConflict(error)) return NextResponse.json({ error: "authorization_changed" }, { status: 409 }); throw error; }
}
