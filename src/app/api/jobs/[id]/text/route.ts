import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documentJobText } from "@/db/jobs-schema";
import { accessJob, audit, context, failure } from "@/lib/jobs/server";
import { JobError } from "@/lib/jobs/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const ctx = await context(req), job = await accessJob(params.id, ctx);
    if (job.expiresAt && job.expiresAt <= new Date() || job.status === "EXPIRED") throw new JobError("Índice textual expirado.", 410);
    if (job.kind !== "OCR" || job.status !== "SUCCEEDED") throw new JobError("Índice textual não disponível.", 409);
    const query = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 200);
    const rows = await db.select({ fileId: documentJobText.fileId, sourceId: documentJobText.sourceId,
      excerpt: sql<string>`left(${documentJobText.text},10000)` }).from(documentJobText).where(and(eq(documentJobText.jobId, job.id), query ? sql`to_tsvector('portuguese',${documentJobText.text}) @@ plainto_tsquery('portuguese',${query})` : undefined)).limit(200);
    await audit(ctx.user.id, "JOB_TEXT_SEARCHED", job.id);
    return Response.json({ results: rows }, { headers: { "cache-control": "private, no-store" } });
  } catch (e) { return failure(e); }
}
