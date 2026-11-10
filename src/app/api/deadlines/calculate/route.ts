import { NextResponse } from "next/server";
import { db } from "@/db";
import { calendarHoliday } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
export async function GET(req: Request) {
  const check = requirePerm(await getSession(req), "doc:view");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const q = new URL(req.url).searchParams, start = q.get("start") ?? "", days = Number(q.get("days"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(days) || days < 0 || days > 365 || isNaN(Date.parse(start)) || new Date(start).toISOString().slice(0, 10) !== start) return NextResponse.json({ error: "invalid_start_or_days" }, { status: 400 });
  const holidays = new Set((await db.select().from(calendarHoliday)).map(h => h.date));
  const date = new Date(`${start}T12:00:00Z`); let remaining = days;
  while (remaining > 0) { date.setUTCDate(date.getUTCDate() + 1); if (![0,6].includes(date.getUTCDay()) && !holidays.has(date.toISOString().slice(0,10))) remaining--; }
  return NextResponse.json({ start, days, businessDays: true, dueDate: date.toISOString().slice(0,10), convention: "EXCLUDE_START_INCLUDE_DUE" });
}
