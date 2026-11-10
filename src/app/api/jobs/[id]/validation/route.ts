import { accessJob, audit, context, failure } from "@/lib/jobs/server";
import { JobError } from "@/lib/jobs/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const ctx = await context(req), job = await accessJob(params.id, ctx);
    if (job.status === "EXPIRED" || job.expiresAt && job.expiresAt <= new Date()) throw new JobError("Evidência expirada. Solicite novo processamento.", 410);
    if (job.status !== "SUCCEEDED" || job.kind !== "PDFA" || !job.validation || !job.expiresAt) throw new JobError("Relatório de validação não disponível.", 409);
    await audit(ctx.user.id, "JOB_VALIDATION_DOWNLOADED", job.id, { sha256: job.outputHash });
    return Response.json(job.validation, { headers: { "content-disposition": `attachment; filename="${job.code}-verapdf.json"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) { return failure(error); }
}
