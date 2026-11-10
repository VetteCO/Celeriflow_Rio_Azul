import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { department, document } from "@/db/schema";
import { getSession, requirePerm, documentScope } from "@/lib/auth";
import { createDocumentWithNumber, formatNumber, sanitizeDocumentHtml } from "@/lib/numbering";
import { isCoreWriteConflict } from "@/lib/core-write-guard";

const CreateSchema = z.object({
  type: z.enum(["MEMORANDUM", "OFICIO", "OTHER"]).default("MEMORANDUM"), subject: z.string().min(3).max(300), body: z.string().min(1).max(100000),
  originDepartmentId: z.string().uuid().nullable().optional(), toDepartmentId: z.string().uuid().nullable().optional(),
  toDepartmentIds: z.array(z.string().uuid()).max(20).default([]),
  accessLevel: z.enum(["INTERNAL", "PUBLIC", "CONFIDENTIAL"]).default("INTERNAL"),
  deadlines: z.array(z.object({ title: z.string().min(1).max(200), dueAt: z.string().datetime() })).max(20).default([]),
});
export async function GET(req: Request) {
  const check = requirePerm(await getSession(req), "doc:view");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const q = new URL(req.url).searchParams;
   const integer = (value: string | null, fallback: number, max: number) => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback; };
   const page = integer(q.get("page"), 1, 1000000), pageSize = integer(q.get("pageSize"), 20, 100);
  const search = q.get("q")?.slice(0, 200);
   const where = and(documentScope(check.session), search ? or(ilike(document.subject, `%${search}%`), ilike(document.businessCode, `%${search}%`), sql`cast(${document.number} as text) = ${search}`, sql`(${document.number}::text || '/' || ${document.year}::text) = ${search}`) : undefined, q.get("type") ? sql`${document.type}::text = ${q.get("type")}` : undefined, q.get("status") ? sql`${document.status}::text = ${q.get("status")}` : undefined, q.get("departmentId") ? sql`exists(select 1 from document_participation p where p.document_id=${document.id} and p.department_id::text=${q.get("departmentId")})` : undefined);
  const [rows, totals, depts] = await Promise.all([db.select().from(document).where(where).orderBy(desc(document.createdAt), desc(document.id)).limit(pageSize).offset((page - 1) * pageSize), db.select({ count: sql<number>`count(*)::int` }).from(document).where(where), db.select().from(department).where(eq(department.active, true))]);
  return NextResponse.json({ documents: rows.map(d => ({ ...d, body: undefined, publicKey: undefined, displayNumber: formatNumber(d.type, d.number, d.year, d.businessCode), origin: depts.find(x => x.id === d.originDepartmentId)?.name ?? "—" })), departments: depts, page, pageSize, total: totals[0].count });
}
export async function POST(req: Request) {
  const check = requirePerm(await getSession(req), "doc:create");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload", issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data, origin = b.originDepartmentId ?? check.session.departmentId;
  if (!sanitizeDocumentHtml(b.body).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() && !/<img\s/i.test(sanitizeDocumentHtml(b.body))) return NextResponse.json({ error: "empty_document" }, { status: 400 });
  if (!origin || !check.session.departmentIds.includes(origin)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const active = await db.select().from(department).where(eq(department.active, true));
  if (![origin, b.toDepartmentId, ...b.toDepartmentIds].filter(Boolean).every(id => active.some(d => d.id === id))) return NextResponse.json({ error: "inactive_department" }, { status: 400 });
  if ([b.toDepartmentId, ...b.toDepartmentIds].includes(origin)) return NextResponse.json({ error: "same_origin_destination" }, { status: 400 });
  try {
    const doc = await createDocumentWithNumber({ ...b, departmentIds: b.toDepartmentIds, originDepartmentId: origin, createdById: check.session.userId });
    return NextResponse.json({ id: doc.id, displayNumber: doc.businessCode, sequentialNumber: doc.number, year: doc.year }, { status: 201 });
  } catch (error) { if (isCoreWriteConflict(error)) return NextResponse.json({ error: "authorization_changed" }, { status: 409 }); throw error; }
}
