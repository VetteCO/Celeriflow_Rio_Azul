import { db } from "@/db";
import { calendarHoliday } from "@/db/schema";
import { businessHours, saveHours, workflowDeadline } from "@/lib/modules/business-hours";
import { context, failure } from "@/lib/modules/server";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET(req:Request) { try { await context(req); return Response.json({hours:await db.select().from(businessHours),holidays:await db.select().from(calendarHoliday),timeZone:"America/Sao_Paulo"}); } catch(e) { return failure(e); } }
export async function PUT(req:Request) { try { return Response.json(await saveHours(await req.json(),await context(req,"doc:edit"))); } catch(e) { return failure(e); } }
export async function POST(req:Request) { try { await context(req); const p=z.object({hours:z.number().positive().max(100000),departmentIds:z.array(z.string().uuid()).min(1).max(100),start:z.string().datetime({offset:true})}).parse(await req.json()); return Response.json({dueAt:await workflowDeadline(p.hours,true,p.departmentIds,new Date(p.start))}); } catch(e) { return failure(e); } }
