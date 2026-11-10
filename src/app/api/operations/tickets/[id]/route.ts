import { db } from "@/db";
import { operationTicket } from "@/db/operations-schema";
import { appUser } from "@/db/schema";
import { actor, failure, OperationError } from "@/lib/operations/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params:paramsPromise}:{params:Promise<{id:string}>}){const params = await paramsPromise;try{
 const {user,manager}=await actor(req);const id=z.string().uuid().parse(params.id);
 const [ticket]=await db.select().from(operationTicket).where(and(eq(operationTicket.id,id),manager?undefined:eq(operationTicket.requesterId,user.id)));
 if(!ticket)throw new OperationError(404,"Chamado não encontrado.");
 return Response.json({ticket},{headers:{"Cache-Control":"private, no-store"}});
}catch(e){return failure(e);}}
export async function PATCH(req:Request,{params:paramsPromise}:{params:Promise<{id:string}>}){const params = await paramsPromise;try{
 const {user,manager}=await actor(req);const id=z.string().uuid().parse(params.id);
 const b=z.object({message:z.string().trim().min(1).max(10000),status:z.enum(["OPEN","IN_PROGRESS","ESCALATED","RESOLVED"]).optional(),assigneeId:z.string().uuid().nullable().optional(),rating:z.number().int().min(1).max(5).optional()}).parse(await req.json());
 const [ticket]=await db.select().from(operationTicket).where(and(eq(operationTicket.id,id),manager?undefined:eq(operationTicket.requesterId,user.id)));
 if(!ticket)throw new OperationError(404,"Chamado não encontrado.");
 if(!manager&&(b.status||b.assigneeId!==undefined))throw new OperationError(403,"Somente a equipe responsável pode alterar situação e atribuição.");
 if(b.rating!==undefined&&(ticket.requesterId!==user.id||ticket.status!=="RESOLVED"))throw new OperationError(409,"A avaliação exige chamado resolvido e seu solicitante.");
 if(b.assigneeId){const [assigned]=await db.select({id:appUser.id}).from(appUser).where(and(eq(appUser.id,b.assigneeId),eq(appUser.active,true)));if(!assigned)throw new OperationError(400,"Responsável inativo ou inexistente.");}
 const status=b.status??ticket.status,assignee=b.assigneeId===undefined?ticket.assigneeId:b.assigneeId;
 if(ticket.status==="RESOLVED"&&b.status&&b.status!=="OPEN"&&b.status!=="RESOLVED")throw new OperationError(409,"Reabra o chamado antes de encaminhá-lo.");
 const event={at:new Date().toISOString(),actor:user.id,message:b.message,status,assignee};
 const [updated]=await db.update(operationTicket).set({status,assigneeId:assignee,history:sql`${operationTicket.history} || ${JSON.stringify([event])}::jsonb`,
 ...(b.rating!==undefined?{rating:b.rating}:{}), ...(manager&&user.id!==ticket.requesterId?{firstResponseAt:sql`coalesce(${operationTicket.firstResponseAt},now())`}:{}),
 ...(b.status?{resolvedAt:status==="RESOLVED"?sql`coalesce(${operationTicket.resolvedAt},now())`:null,...(ticket.status==="RESOLVED"&&status==="OPEN"?{rating:null}:{} )}:{}),
 }).where(and(eq(operationTicket.id,id),sql`${operationTicket.history} = ${JSON.stringify(ticket.history)}::jsonb`)).returning();
 if(!updated)throw new OperationError(409,"O chamado foi atualizado por outro usuário. Recarregue e tente novamente.");
 return Response.json({ticket:updated});
}catch(e){return failure(e);}}
