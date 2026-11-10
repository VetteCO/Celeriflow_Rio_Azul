import { NextResponse } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { document, documentDeadline, calendarHoliday } from "@/db/schema";
import { getSession, requirePerm, documentScope } from "@/lib/auth";
import { formatNumber } from "@/lib/numbering";
export async function GET(req: Request) {
  const check = requirePerm(await getSession(req), "doc:view");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const q = new URL(req.url).searchParams;
  const month = q.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  const start = new Date(`${month}-01T00:00:00.000Z`), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCMilliseconds(-1);
  const rows = await db.select({ deadline: documentDeadline, doc: document }).from(documentDeadline).innerJoin(document, eq(document.id, documentDeadline.documentId)).where(and(documentScope(check.session), gte(documentDeadline.dueAt, start), lte(documentDeadline.dueAt, end))).orderBy(asc(documentDeadline.dueAt));
  return NextResponse.json({ month, deadlines: rows.map(({ deadline, doc }) => ({ ...deadline, subject: doc.subject, displayNumber: formatNumber(doc.type, doc.number, doc.year, doc.businessCode) })), holidays: await db.select().from(calendarHoliday).where(and(gte(calendarHoliday.date, `${month}-01`), lte(calendarHoliday.date, `${month}-31`))) });
}
