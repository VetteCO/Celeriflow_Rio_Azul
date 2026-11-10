import { accessJob, audit, context, failure, jobView, retryJob } from "@/lib/jobs/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try { const ctx = await context(req); const job = await accessJob(params.id, ctx); await audit(ctx.user.id, "JOB_VIEWED", job.id); return Response.json({ job: jobView(job) }, { headers: { "cache-control": "private, no-store" } }); } catch (e) { return failure(e); }
}
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try { return Response.json({ job: await retryJob(params.id, await context(req)) }); } catch (e) { return failure(e); }
}
