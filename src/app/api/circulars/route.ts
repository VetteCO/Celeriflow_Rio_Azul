import { NextResponse } from "next/server";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appUser, department, document, documentReadReceipt, documentRecipient, userDepartment } from "@/db/schema";
import { getSession, requirePerm, documentScope } from "@/lib/auth";
import { createDocumentWithNumber, formatNumber } from "@/lib/numbering";
const Schema = z.object({ subject: z.string().min(3).max(300), body: z.string().min(1).max(100000), urgency: z.enum(["URGENT", "INFORMATIVE"]), originDepartmentId: z.string().uuid().nullable().optional(), departmentIds: z.array(z.string().uuid()).min(1).max(50), includeSubdepartments: z.boolean().default(false) });
export async function GET(req: Request) {
  const check = requirePerm(await getSession(req), "circular:view");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const q = new URL(req.url).searchParams;
  const paging = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) }).safeParse({ page: q.get("page") ?? undefined, pageSize: q.get("pageSize") ?? undefined });
  if (!paging.success) return NextResponse.json({ error: "invalid_pagination" }, { status: 400 });
  const { page, pageSize } = paging.data;
  const search = (q.get("q") ?? q.get("search") ?? "").trim().slice(0, 200);
  const where = and(eq(document.type, "CIRCULAR"), documentScope(check.session), search ? or(ilike(document.subject, `%${search}%`), ilike(document.businessCode, `%${search}%`), sql`cast(${document.number} as text) = ${search}`) : undefined,
    q.get("urgency") ? eq(document.urgency, q.get("urgency")!) : undefined,
    q.get("status") ? sql`${document.status}::text = ${q.get("status")}` : undefined,
    q.get("unread") === "1" ? sql`exists(select 1 from document_recipient r where r.document_id=${document.id} and r.user_id is not null and r.recipient_type <> 'CANCELLED' and not exists(select 1 from document_read_receipt rc where rc.document_id=r.document_id and rc.user_id=r.user_id))` : undefined);
  const [rows, totals] = await Promise.all([db.select().from(document).where(where).orderBy(desc(document.createdAt), desc(document.id)).limit(pageSize).offset((page - 1) * pageSize), db.select({ count: sql<number>`count(*)::int` }).from(document).where(where)]);
  const ids = rows.map(d => d.id);
  const recipients = ids.length ? await db.select().from(documentRecipient).where(inArray(documentRecipient.documentId, ids)) : [];
  const receipts = ids.length ? await db.select().from(documentReadReceipt).where(inArray(documentReadReceipt.documentId, ids)) : [];
  return NextResponse.json({ page, pageSize, total: totals[0].count, circulars: rows.map(d => {
    const population = new Set(recipients.filter(r => r.documentId === d.id && r.userId && r.recipientType !== "CANCELLED").map(r => r.userId));
    const read = new Set(receipts.filter(r => r.documentId === d.id && population.has(r.userId)).map(r => r.userId)).size;
    return { id: d.id, displayNumber: formatNumber(d.type, d.number, d.year, d.businessCode), subject: d.subject, urgency: d.urgency, status: d.status, createdAt: d.createdAt, total: population.size, read, unread: population.size - read };
  }), departments: await db.select().from(department).where(eq(department.active, true)) });
}
export async function POST(req: Request) {
  const check = requirePerm(await getSession(req), "doc:create");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const b = parsed.data, origin = b.originDepartmentId ?? check.session.departmentId;
  if (!origin || !check.session.departmentIds.includes(origin)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const depts = await db.select().from(department).where(eq(department.active, true));
  const target = new Set(b.departmentIds);
  if (!depts.some(d => d.id === origin) || b.departmentIds.some(id => !depts.some(d => d.id === id))) return NextResponse.json({ error: "inactive_department" }, { status: 400 });
  if (b.includeSubdepartments) { let changed = true; while (changed) { changed = false; for (const d of depts) if (d.parentId && target.has(d.parentId) && !target.has(d.id)) { target.add(d.id); changed = true; } } }
  const users = await db.select().from(appUser).where(eq(appUser.active, true));
  const secondary = await db.select().from(userDepartment).where(inArray(userDepartment.departmentId, Array.from(target)));
  const recipientUsers = users.filter(u => !!u.departmentId && target.has(u.departmentId) || secondary.some(s => s.userId === u.id)).map(u => ({ id: u.id, departmentId: u.departmentId && target.has(u.departmentId) ? u.departmentId : secondary.find(s => s.userId === u.id)!.departmentId }));
  if (!recipientUsers.length) return NextResponse.json({ error: "no_active_recipients" }, { status: 400 });
  const doc = await createDocumentWithNumber({ ...b, type: "CIRCULAR", originDepartmentId: origin, createdById: check.session.userId, departmentIds: Array.from(target), recipientUsers });
  return NextResponse.json({ id: doc.id, displayNumber: doc.businessCode, recipients: recipientUsers.length }, { status: 201 });
}
