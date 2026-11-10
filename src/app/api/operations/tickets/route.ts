import { db } from "@/db";
import { operationTicket } from "@/db/operations-schema";
import { actor, failure } from "@/lib/operations/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{const {user,manager}=await actor(req);const tickets=await db.select().from(operationTicket).where(manager?undefined:eq(operationTicket.requesterId,user.id)).orderBy(desc(operationTicket.createdAt));return Response.json({tickets,manager});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const {user}=await actor(req);const b=z.object({subject:z.string().trim().min(3).max(200),message:z.string().trim().min(10).max(10000),severity:z.enum(["CRITICAL","HIGH","NORMAL"])}).parse(await req.json());
 const hours={CRITICAL:2,HIGH:8,NORMAL:24}[b.severity];const now=new Date();
 const [ticket]=await db.insert(operationTicket).values({requesterId:user.id,subject:b.subject,severity:b.severity,dueAt:new Date(now.getTime()+hours*3600000),history:[{at:now.toISOString(),actor:user.id,message:b.message,status:"OPEN",assignee:null}]}).returning();
 return Response.json({ticket},{status:201});
}catch(e){return failure(e);}}
