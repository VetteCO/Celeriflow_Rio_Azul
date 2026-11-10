import { and, eq, sql } from "drizzle-orm";
import { pgTable, uuid, jsonb, integer, boolean, text } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { calendarHoliday, department } from "@/db/schema";
import { admin, ModuleError, type Context } from "./server";

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const shiftSchema = z.object({ day: z.number().int().min(1).max(5), start: time, end: time });
export const hoursSchema = z.object({ departmentId: z.string().uuid(), revision: z.number().int().min(0), active: z.boolean(), shifts: z.array(shiftSchema).min(1).max(40), note: z.string().trim().min(3).max(2000) }).superRefine((v, ctx) => {
  const sorted = [...v.shifts].sort((a,b) => a.day-b.day || a.start.localeCompare(b.start));
  sorted.forEach((s,i) => { if (s.end <= s.start || (i > 0 && sorted[i-1].day === s.day && sorted[i-1].end > s.start)) ctx.addIssue({ code: "custom", message: "Turnos devem terminar no mesmo dia e não podem se sobrepor." }); });
});
export type Shift = z.infer<typeof shiftSchema>;
export const businessHours = pgTable("module_business_hours", { departmentId: uuid("department_id").primaryKey(), revision: integer("revision").notNull(), active: boolean("active").notNull(), shifts: jsonb("shifts").$type<Shift[]>().notNull(), actorId: uuid("actor_id").notNull(), note: text("note").notNull() });
export async function saveHours(input: unknown, ctx: Context) {
  admin(ctx); const p = hoursSchema.parse(input);
  const [sector] = await db.select().from(department).where(and(eq(department.id,p.departmentId),eq(department.active,true)));
  if (!sector) throw new ModuleError("Selecione um setor ativo.");
  const values = { ...p, revision:p.revision+1, actorId:ctx.user.id };
  const rows = p.revision === 0 ? await db.insert(businessHours).values(values).onConflictDoNothing().returning() : await db.update(businessHours).set(values).where(and(eq(businessHours.departmentId,p.departmentId),eq(businessHours.revision,p.revision))).returning();
  if (!rows.length) throw new ModuleError("Expediente alterado por outro usuário. Recarregue.",409);
  return rows[0];
}
const zone = "America/Sao_Paulo";
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone:zone, year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23" });
function parts(date: Date) { return Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value])); }
function localInstant(day: string, clock: string) {
  const desired = Date.parse(`${day}T${clock}:00Z`); let instant = desired;
  for(let i=0;i<4;i++) { const p=parts(new Date(instant)); const represented=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`); const delta=desired-represented; instant+=delta; if(!delta) break; }
  return instant;
}
/** Exact elapsed milliseconds inside configured shifts; weekends and municipal holidays excluded. */
export function calculateBusinessDeadline(start: Date, hours: number, shifts: Shift[], holidays: Set<string>) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(hours) || hours <= 0) throw new ModuleError("Data ou prazo inválido.");
  let remaining=hours*3600000; const p=parts(start); let day=new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
  for(let count=0;count<36600;count++,day=new Date(day.getTime()+86400000)) {
    const key=day.toISOString().slice(0,10), weekday=day.getUTCDay();
    if(weekday===0 || weekday===6 || holidays.has(key)) continue;
    for(const shift of shifts.filter(s=>s.day===weekday).sort((a,b)=>a.start.localeCompare(b.start))) {
      const from=Math.max(start.getTime(),localInstant(key,shift.start)), until=localInstant(key,shift.end);
      if(until<=from) continue;
      if(remaining<=until-from) return new Date(from+remaining).toISOString();
      remaining-=until-from;
    }
  }
  throw new ModuleError("O expediente não comporta o prazo no horizonte de 100 anos.");
}
/** Parallel sectors each receive the same SLA; the stage deadline is the latest sector deadline. */
export async function workflowDeadline(hours: number, businessDays = false, departmentIds: string[] = [], start = new Date()) {
  if(!businessDays) return new Date(start.getTime()+hours*3600000).toISOString();
  if(!departmentIds.length) throw new ModuleError("Informe os setores responsáveis pelo prazo útil.");
  const holidays=new Set((await db.select().from(calendarHoliday)).map(h=>h.date));
  const rows=await db.select().from(businessHours).where(sql`${businessHours.departmentId} in (${sql.join(departmentIds.map(id=>sql`${id}::uuid`),sql`,`)})`);
  const deadlines=departmentIds.map(id=>{ const row=rows.find(r=>r.departmentId===id && r.active); if(!row) throw new ModuleError(`Configure e ative o expediente do setor ${id} antes de protocolar/avançar.`); return calculateBusinessDeadline(start,hours,row.shifts,holidays); });
  return deadlines.sort().at(-1)!;
}
