import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { calendarHoliday, auditLog } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
const Schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s), title: z.string().min(2).max(200) });
export async function POST(req: Request) {
  const check = requirePerm(await getSession(req), "admin:departments");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  if (!check.session.roles.includes("ADMIN_GERAL")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = Schema.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const [result] = await db.batch([db.insert(calendarHoliday).values(b.data).onConflictDoUpdate({ target: calendarHoliday.date, set: { title: b.data.title } }).returning(), db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "HOLIDAY_CONFIGURED", entityType: "calendar_holiday", metadata: b.data })]);
  return NextResponse.json(result[0], { status: 201 });
}
