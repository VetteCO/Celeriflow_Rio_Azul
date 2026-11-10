import { db } from "@/db";
import { operationCourse, operationProgress } from "@/db/operations-schema";
import { actor, failure, OperationError, download } from "@/lib/operations/server";
import { pdf } from "@/lib/operations/formats";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
const input = z.discriminatedUnion("action", [z.object({action:z.literal("lesson"),index:z.number().int().min(0)}),z.object({action:z.literal("assessment"),answers:z.array(z.number().int().min(0)).max(100)})]);
export async function POST(req:Request,{params:paramsPromise}:{params:Promise<{id:string}>}) { const params = await paramsPromise; try {
  const {user} = await actor(req); const id=z.string().uuid().parse(params.id); const body=input.parse(await req.json());
  const [course]=await db.select().from(operationCourse).where(and(eq(operationCourse.id,id),eq(operationCourse.published,true)));
  if(!course) throw new OperationError(404,"Curso não encontrado.");
  await db.insert(operationProgress).values({courseId:id,userId:user.id}).onConflictDoNothing();
  const where=and(eq(operationProgress.courseId,id),eq(operationProgress.userId,user.id));
  if(body.action==="lesson") {
    if(body.index>=course.lessons.length) throw new OperationError(400,"Aula inválida.");
    const updated=await db.update(operationProgress).set({completed:body.index+1}).where(and(where,eq(operationProgress.completed,body.index))).returning();
    if(!updated.length) { const [current]=await db.select().from(operationProgress).where(where); if(current.completed<=body.index) throw new OperationError(409,"Conclua as aulas anteriores primeiro."); }
  } else {
    if(body.answers.length!==course.questions.length || body.answers.some((a,i)=>a>=course.questions[i].options.length)) throw new OperationError(400,"Responda todas as questões.");
    const score=Math.round(100*body.answers.filter((a,i)=>a===course.questions[i].answer).length/course.questions.length);
    const updated=await db.update(operationProgress).set({score, ...(score>=course.passScore ? {certificateCode:sql`coalesce(${operationProgress.certificateCode},operations_next_code())`,certifiedAt:sql`coalesce(${operationProgress.certifiedAt},now())`} : {})}).where(and(where,eq(operationProgress.completed,course.lessons.length),sql`${operationProgress.certificateCode} is null`)).returning();
    if(!updated.length) throw new OperationError(409,"Conclua as aulas antes da avaliação. Certificados já emitidos são imutáveis.");
  }
  const [progress]=await db.select().from(operationProgress).where(where);return Response.json({progress});
}catch(e){return failure(e);} }
export async function GET(req:Request,{params:paramsPromise}:{params:Promise<{id:string}>}) { const params = await paramsPromise; try {
  const {user}=await actor(req);const id=z.string().uuid().parse(params.id);
  const [result]=await db.select({course:operationCourse,progress:operationProgress}).from(operationProgress).innerJoin(operationCourse,eq(operationProgress.courseId,operationCourse.id)).where(and(eq(operationProgress.courseId,id),eq(operationProgress.userId,user.id)));
  if(!result?.progress.certificateCode) throw new OperationError(404,"Certificado ainda não disponível.");
  return download(pdf(["Celeriflow - Certificado de capacitação",`Código: ${result.progress.certificateCode}`,`Participante: ${user.name}`,`Curso: ${result.course.title}`,`Módulo: ${result.course.module}`,`Aulas concluídas: ${result.progress.completed}`,`Nota: ${result.progress.score}%`,`Conclusão: ${result.progress.certifiedAt?.toISOString()}`,"Certificado de conclusão registrado na plataforma."]),"application/pdf",`certificado-${result.progress.certificateCode}.pdf`);
}catch(e){return failure(e);} }
