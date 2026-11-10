import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUser, role, userRole, auditLog } from "@/db/schema";
import { operationReport } from "@/db/operations-schema";
import { consistentReport as report } from "@/lib/operations/consistent-report";
import { billingRows } from "./billing";

export function validSchedulerSecret(authorization: string | null) {
  const secret = process.env.OPERATIONS_SCHEDULER_SECRET;
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function generatePreviousMonthReport() {
  const userId = process.env.OPERATIONS_SERVICE_USER_ID;
  if (!userId || !/^[a-f0-9-]{36}$/i.test(userId)) throw new Error("Conta operacional não configurada.");
  const [operator] = await db.select({ id: appUser.id }).from(appUser)
    .innerJoin(userRole, eq(userRole.userId, appUser.id)).innerJoin(role, eq(role.id, userRole.roleId))
    .where(and(eq(appUser.id, userId), eq(appUser.active, true), eq(role.name, "ADMIN_GERAL")));
  if (!operator) throw new Error("Conta operacional indisponível.");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find(p => p.type === "year")?.value);
  const month = Number(parts.find(p => p.type === "month")?.value);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const period = previous.toISOString().slice(0, 7);
  const requestKey = `scheduled-contract:${period}`;
  const [existing] = await db.select().from(operationReport).where(eq(operationReport.requestKey, requestKey));
  if (existing) return { id: existing.id, code: existing.code, period, created: false };
  const lastDay = new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth() + 1, 0)).getUTCDate();
  const filters = { from: `${period}-01`, to: `${period}-${lastDay}` };
  const rows=await report(filters);rows.push(...billingRows(period,rows));
  const snapshot = { filters, rows, generatedAt: new Date().toISOString() };
  const [created] = await db.insert(operationReport).values({ createdById: operator.id, period, requestKey, snapshot }).onConflictDoNothing().returning();
  if (created) await db.insert(auditLog).values({ actorType: "SYSTEM", actorId: operator.id, action: "CONTRACT_REPORT_SCHEDULED", entityType: "operation_report", entityId: created.id, metadata: { period } });
  const [saved] = created ? [created] : await db.select().from(operationReport).where(eq(operationReport.requestKey, requestKey));
  return { id: saved.id, code: saved.code, period, created: !!created };
}
