import { accessJob, audit, context, failure } from "@/lib/jobs/server";
import { downloadAttachment } from "@/lib/blob";
import { JobError } from "@/lib/jobs/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const ctx = await context(req); const job = await accessJob(params.id, ctx);
    if (job.status === "EXPIRED" || job.expiresAt && job.expiresAt <= new Date()) throw new JobError("Artefato expirado. Solicite novo processamento.", 410);
    if (job.status !== "SUCCEEDED" || !job.outputKey) throw new JobError("Artefato ainda não disponível.", 409);
    const blob = await downloadAttachment(job.outputKey);
    if (!blob) throw new JobError("Artefato indisponível no armazenamento.", 404);
    await audit(ctx.user.id, "JOB_DOWNLOADED", job.id, { sha256: job.outputHash });
    return new Response(blob.stream, { headers: { "content-type": job.outputType ?? "application/octet-stream", "content-length": String(blob.size),
      "content-disposition": `attachment; filename="${job.outputName}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (e) { return failure(e); }
}
