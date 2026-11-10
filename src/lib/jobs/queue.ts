import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { documentJob, type DocumentJob } from "@/db/jobs-schema";
import { ConfigurationError, PermanentError } from "./types";
import { JobError } from "./types";
import { ModuleError } from "@/lib/modules/server";

export const blobToken = () => (process.env.BLOB_READ_WRITE_TOKEN ?? "").trim().replace(/^"|"$/g, "");
export async function claim(): Promise<DocumentJob | null> {
  const token = randomUUID();
  // Single statement transaction: two workers never own the same lease. Expired leases consume attempts.
  await db.execute(sql`UPDATE document_job SET status='FAILED',error='Limite de tentativas atingido após interrupção do executor.',lease_token=NULL,lease_until=NULL,updated_at=now()
    WHERE status='RUNNING' AND lease_until<now() AND attempts>=max_attempts`);
  await db.execute(sql`WITH next AS (
    SELECT id FROM document_job WHERE attempts<max_attempts AND
      ((status IN ('QUEUED','RETRY') AND available_at<=now()) OR (status='RUNNING' AND lease_until<now()))
    ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE document_job j SET status='RUNNING',attempts=j.attempts+1,lease_token=${token}::uuid,
    lease_until=now()+interval '180 seconds',updated_at=now(),error=NULL FROM next WHERE j.id=next.id`);
  return (await db.select().from(documentJob).where(eq(documentJob.leaseToken, token)))[0] ?? null;
}
export async function heartbeat(job: DocumentJob) {
  const rows = await db.update(documentJob).set({ leaseUntil: sql`now()+interval '180 seconds'`, updatedAt: new Date() }).where(and(eq(documentJob.id, job.id), eq(documentJob.leaseToken, job.leaseToken!), eq(documentJob.status, "RUNNING"), sql`${documentJob.leaseUntil}>now()`)).returning({ id: documentJob.id });
  return !!rows.length;
}
export async function fail(job: DocumentJob, error: unknown) {
  const blocked = error instanceof ConfigurationError;
  const permanent = error instanceof PermanentError || error instanceof JobError || error instanceof ModuleError;
  const message = blocked || permanent ? (error as Error).message : "Falha no executor. Consulte o log operacional e a configuração; nova tentativa automática quando disponível.";
  await db.update(documentJob).set({ status: blocked ? "BLOCKED" : permanent || job.attempts >= job.maxAttempts ? "FAILED" : "RETRY", error: message.slice(0, 2000),
    leaseToken: null, leaseUntil: null, updatedAt: new Date(), availableAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000) })
    .where(and(eq(documentJob.id, job.id), eq(documentJob.leaseToken, job.leaseToken!), eq(documentJob.status, "RUNNING"), sql`${documentJob.leaseUntil}>now()`));
}
export async function cleanup() {
  // Logical TTL is checked independently on download; physical deletion is retryable.
  await db.execute(sql`WITH expired AS (UPDATE document_job SET status='EXPIRED',updated_at=now() WHERE status='SUCCEEDED' AND expires_at<=now() RETURNING id)
    DELETE FROM document_job_text WHERE job_id IN (SELECT id FROM expired)`);
  const result = await db.execute(sql`SELECT pathname FROM document_job_blob WHERE expires_at<=now() LIMIT 100`);
  for (const row of result.rows as { pathname: string }[]) {
    try {
      await del(row.pathname, { token: blobToken() });
      await db.execute(sql`DELETE FROM document_job_blob WHERE pathname=${row.pathname}`);
      await db.execute(sql`UPDATE document_job SET output_key=NULL WHERE output_key=${row.pathname} AND expires_at<=now()`);
    } catch (error) { console.error("[jobs] remoção de artefato pendente", error); }
  }
}
