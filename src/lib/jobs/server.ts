import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql, ilike, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appUser, attachment, auditLog, role, userRole, userDepartment } from "@/db/schema";
import { moduleFile } from "@/db/modules-schema";
import { documentJob, type DocumentJob } from "@/db/jobs-schema";
import { canAccessDocument, documentScope, requirePerm, type Session } from "@/lib/auth";
import { PERMS, type Role } from "@/lib/rbac";
import { context, getRecord, scope, ModuleError, type Context } from "@/lib/modules/server";
import { JobError, jobInputSchema, type JobPayload, type SourceRef } from "./types";
import { processTree } from "@/lib/process-tree";

export { context };
export function failure(error: unknown) {
  if (error instanceof JobError || error instanceof ModuleError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return Response.json({ error: error.issues.map(i => i.message).join("; ") }, { status: 400 });
  console.error("[jobs]", error);
  return Response.json({ error: "Não foi possível concluir o processamento documental." }, { status: 500 });
}
// Reload active accounts, roles and secondary sectors for background processing and delegated access.
export async function userContext(id: string): Promise<Context> {
  const [user] = await db.select().from(appUser).where(and(eq(appUser.id, id), eq(appUser.active, true)));
  if (!user?.firebaseUid) throw new JobError("Servidor indisponível para processamento.", 403);
  const [links, sectors] = await Promise.all([
    db.select({ name: role.name }).from(userRole).innerJoin(role, eq(role.id, userRole.roleId)).where(eq(userRole.userId, id)),
    db.select().from(userDepartment).where(eq(userDepartment.userId, id)),
  ]);
  const roles = links.map(r => r.name).filter((r): r is Role => Object.prototype.hasOwnProperty.call(PERMS, r));
  const session: Session = { uid: user.firebaseUid, userId: id, roles, departmentId: user.departmentId, departmentIds: Array.from(new Set([user.departmentId, ...sectors.map(s => s.departmentId)].filter((s): s is string => !!s))) };
  if (!requirePerm(session, "doc:view").ok) throw new JobError("Permissão de leitura revogada.", 403);
  return { user, session };
}
export async function authorizeSources(refs: SourceRef[], ctx: Context) {
  for (const ref of refs) {
    if (ref.type === "module") await getRecord(ref.id, ctx);
    else if (!await canAccessDocument(ctx.session, ref.id)) throw new JobError("Documento não encontrado no seu escopo.", 404);
  }
}
async function capture(input: z.infer<typeof jobInputSchema>, ctx: Context): Promise<JobPayload> {
  const pending: SourceRef[] = input.selection === "complete"
    ? (await processTree(input.sources, ctx, false)).nodes.map(({ type, id }) => ({ type, id }))
    : [...input.sources];
  const seen = new Set<string>();
  const payload: JobPayload = { sources: [], files: [], selection: input.selection, capturedAt: new Date().toISOString() };
  while (pending.length) {
    const ref = pending.shift()!; const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > 100) throw new JobError("A seleção completa ultrapassa 100 documentos. Use uma seleção personalizada.");
    if (ref.type === "document") {
      const doc = await canAccessDocument(ctx.session, ref.id);
      if (!doc) throw new JobError("Documento fora do escopo.", 404);
      payload.sources.push({ ...ref, code: doc.businessCode ?? `${doc.number}/${doc.year}`, title: doc.subject, body: doc.body, blocks: [] });
      const files = await db.select().from(attachment).where(eq(attachment.documentId, ref.id)).orderBy(attachment.createdAt, attachment.id);
      payload.files.push(...files.map(f => ({ id: f.id, sourceId: ref.id, filename: f.filename, mimeType: f.mimeType ?? "application/octet-stream", storageKey: f.storageKey, size: f.size })));
    } else {
      const row = await getRecord(ref.id, ctx);
      // Identity, internal metadata and signatures are deliberately not serialized into exports.
      payload.sources.push({ ...ref, code: row.code, title: row.title, body: row.body, blocks: row.data.blocks ?? [], revision: row.revision });
      const files = await db.select().from(moduleFile).where(eq(moduleFile.recordId, ref.id)).orderBy(moduleFile.createdAt, moduleFile.id);
      payload.files.push(...files.map(f => ({ id: f.id, sourceId: ref.id, filename: f.filename, mimeType: f.mimeType, storageKey: f.storageKey, size: f.size, sha256: f.sha256 })));
    }
  }
  if (input.fileIds !== undefined && input.selection === "custom") {
    if (input.fileIds.some(id => !payload.files.some(f => f.id === id))) throw new JobError("Anexo não pertence aos documentos selecionados.");
    payload.files = payload.files.filter(f => input.fileIds!.includes(f.id));
  }
  if (payload.files.length > 200) throw new JobError("Selecione até 200 anexos.");
  if (input.kind === "OCR" && !payload.files.length) throw new JobError("Selecione ao menos um anexo PDF ou imagem para OCR.");
  return payload;
}
export function jobView(row: DocumentJob) {
  return { id: row.id, code: row.code, kind: row.kind, status: row.expiresAt && row.expiresAt <= new Date() ? "EXPIRED" : row.status,
    attempts: row.attempts, error: row.error, createdAt: row.createdAt, updatedAt: row.updatedAt, expiresAt: row.expiresAt,
    outputName: row.outputName, outputSize: row.outputSize, outputHash: row.outputHash,
    downloadUrl: row.status === "SUCCEEDED" && row.expiresAt && row.expiresAt > new Date() ? `/api/jobs/${row.id}/download` : null,
    validationUrl: row.validation && row.status === "SUCCEEDED" && row.expiresAt && row.expiresAt > new Date() ? `/api/jobs/${row.id}/validation` : null,
    sources: row.payload.sources.map(({ id, type, code, title, revision }) => ({ id, type, code, title, revision })) };
}
export async function accessJob(id: string, ctx: Context) {
  z.string().uuid().parse(id);
  const [row] = await db.select().from(documentJob).where(and(eq(documentJob.id, id), or(eq(documentJob.ownerId, ctx.user.id), eq(documentJob.assigneeId, ctx.user.id))));
  if (!row) throw new JobError("Processamento não encontrado.", 404);
  await authorizeSources(row.payload.sources, ctx);
  return row;
}
export async function createJob(data: unknown, ctx: Context) {
  const input = jobInputSchema.parse(data);
  const requestHash = createHash("sha256").update(JSON.stringify({ ...input, idempotencyKey: undefined })).digest("hex");
  const find = async () => (await db.select().from(documentJob).where(and(eq(documentJob.ownerId, ctx.user.id), eq(documentJob.idempotencyKey, input.idempotencyKey))))[0];
  const existing = await find();
  if (existing) {
    if (existing.requestHash !== requestHash) throw new JobError("Chave de idempotência já utilizada com outra seleção.", 409);
    await authorizeSources(existing.payload.sources, ctx); return jobView(existing);
  }
  const payload = await capture(input, ctx);
  if (input.assigneeId) await authorizeSources(payload.sources, await userContext(input.assigneeId));
  const [created] = await db.insert(documentJob).values({ ownerId: ctx.user.id, assigneeId: input.assigneeId, kind: input.kind, idempotencyKey: input.idempotencyKey, requestHash, payload }).onConflictDoNothing().returning();
  const row = created ?? await find();
  if (!row || row.requestHash !== requestHash) throw new JobError("Solicitação concorrente incompatível.", 409);
  if (created) await audit(ctx.user.id, "JOB_CREATED", row.id, { kind: row.kind, code: row.code });
  return jobView(row);
}
export async function audit(actorId: string, action: string, id: string, metadata: Record<string, unknown> = {}) {
  await db.insert(auditLog).values({ actorType: "USER", actorId, action, entityType: "document_job", entityId: id, metadata });
}
export async function listJobs(ctx: Context, params: URLSearchParams) {
  const input = z.object({ page: z.coerce.number().int().min(1).max(1000000).default(1), q: z.string().max(200).default(""),
    sort: z.enum(["code", "kind", "status", "error", "expires", "createdAt", "actions"]).default("createdAt"),
    desc: z.enum(["true", "false"]).default("true"), status: z.enum(["", "QUEUED", "RUNNING", "RETRY", "BLOCKED", "FAILED", "SUCCEEDED", "EXPIRED"]).default("")
  }).parse(Object.fromEntries(params));
  // Reuse the canonical SQL scopes for EVERY captured source before counting or paging.
  // The correlated subqueries read current records, so deleted sources and revoked access disappear.
  const authorized = sql`NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(${documentJob.payload}->'sources') source
    WHERE NOT (CASE source->>'type'
      WHEN 'document' THEN EXISTS (SELECT 1 FROM document WHERE document.id::text=source->>'id' AND (${documentScope(ctx.session)}))
      WHEN 'module' THEN EXISTS (SELECT 1 FROM module_record WHERE module_record.id::text=source->>'id' AND (${scope(ctx)}))
      ELSE false END))`;
  const effectiveStatus = sql<string>`CASE WHEN ${documentJob.expiresAt}<=now() THEN 'EXPIRED' ELSE ${documentJob.status} END`;
  const detail = sql<string>`coalesce(${documentJob.error},(SELECT string_agg(s->>'title','; ') FROM jsonb_array_elements(${documentJob.payload}->'sources') s),'')`;
  const needle = `%${input.q.trim().replace(/[\\%_]/g, "\\$&")}%`;
  const where = and(or(eq(documentJob.ownerId, ctx.user.id), eq(documentJob.assigneeId, ctx.user.id)), authorized,
    input.status ? sql`${effectiveStatus}=${input.status}` : undefined,
    input.q.trim() ? or(ilike(documentJob.code, needle), ilike(documentJob.kind, needle), sql`${effectiveStatus} ILIKE ${needle}`, sql`${detail} ILIKE ${needle}`) : undefined);
  const columns = { code: documentJob.code, kind: documentJob.kind, status: effectiveStatus, error: detail, expires: documentJob.expiresAt, createdAt: documentJob.createdAt, actions: effectiveStatus };
  const order = input.desc === "true" ? desc : asc;
  const [totals, rows] = await db.batch([
    db.select({ total: count() }).from(documentJob).where(where),
    db.select().from(documentJob).where(where).orderBy(order(columns[input.sort]), order(documentJob.id)).limit(20).offset((input.page - 1) * 20),
  ]);
  return { jobs: rows.map(jobView), total: totals[0]?.total ?? 0, page: input.page, pageSize: 20 };
}
export async function retryJob(id: string, ctx: Context) {
  const row = await accessJob(id, ctx);
  if (row.ownerId !== ctx.user.id) throw new JobError("Somente o solicitante pode reenfileirar.", 403);
  const updated = await db.update(documentJob).set({ status: "QUEUED", attempts: 0, error: null, availableAt: new Date(), updatedAt: new Date() }).where(and(eq(documentJob.id, id), inArray(documentJob.status, ["FAILED", "BLOCKED"]))).returning();
  if (!updated.length) throw new JobError("Situação incompatível com nova tentativa.", 409);
  await audit(ctx.user.id, "JOB_REQUEUED", id); return jobView(updated[0]);
}
