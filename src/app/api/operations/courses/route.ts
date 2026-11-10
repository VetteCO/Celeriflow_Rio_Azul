import { db } from "@/db";
import { operationCourse, operationProgress } from "@/db/operations-schema";
import { actor, failure } from "@/lib/operations/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { try {
  const { user } = await actor(req);
  const [courses, progress] = await Promise.all([db.select().from(operationCourse).where(eq(operationCourse.published,true)).orderBy(desc(operationCourse.createdAt)), db.select().from(operationProgress).where(eq(operationProgress.userId,user.id))]);
  return Response.json({ courses: courses.map(c => ({ ...c, questions: c.questions.map(({answer, ...q}) => q), progress: progress.find(p => p.courseId === c.id) ?? null })) });
} catch(e) { return failure(e); } }
const input = z.object({ title: z.string().trim().min(3).max(200), module: z.string().trim().min(2).max(80), passScore: z.number().int().min(1).max(100),
  lessons: z.array(z.object({title:z.string().trim().min(1).max(200),videoUrl:z.string().url().refine(s => s.startsWith("https://")),content:z.string().max(20000)})).min(1).max(100),
  questions: z.array(z.object({prompt:z.string().min(3).max(1000),options:z.array(z.string().min(1).max(500)).min(2).max(8),answer:z.number().int().min(0)}).refine(q => q.answer<q.options.length)).min(1).max(100),
});
export async function POST(req: Request) { try { const {user}=await actor(req,"operations:manage"); const body = input.parse(await req.json()); const [course] = await db.insert(operationCourse).values({...body,createdById:user.id}).returning(); return Response.json({course}, {status:201}); } catch(e) {return failure(e);} }
