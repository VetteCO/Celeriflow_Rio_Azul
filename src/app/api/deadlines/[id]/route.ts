import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documentDeadline, auditLog } from "@/db/schema";
import { getSession, requirePerm, canAccessDocument, canActInDepartment } from "@/lib/auth";
const Schema = z.object({ title: z.string().min(1).max(200).optional(), dueAt: z.string().datetime().optional(), status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional() });
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const check = requirePerm(await getSession(req), "doc:edit");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const b = Schema.safeParse(await req.json().catch(() => null));
  if (!b.success || !Object.keys(b.data).length) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const [deadline] = await db.select().from(documentDeadline).where(eq(documentDeadline.id, params.id));
  if (!deadline || !await canAccessDocument(check.session, deadline.documentId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!check.session.departmentId || !await canActInDepartment(check.session, deadline.documentId, check.session.departmentId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await db.batch([db.update(documentDeadline).set({ ...b.data, dueAt: b.data.dueAt ? new Date(b.data.dueAt) : undefined }).where(eq(documentDeadline.id, deadline.id)), db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "DEADLINE_UPDATED", entityType: "document_deadline", entityId: deadline.id, metadata: { before: deadline, after: b.data } })]);
  return NextResponse.json({ ok: true });
}
