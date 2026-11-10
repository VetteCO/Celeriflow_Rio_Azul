import { createHash } from "node:crypto";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLog, department } from "@/db/schema";
import { moduleRecord, moduleFile, moduleMandate, type ModuleRecord } from "@/db/modules-schema";
import { getCitizenSession } from "@/lib/citizen-auth";
import { ModuleError, validateBusiness } from "./server";
import { workflowDeadline } from "./business-hours";
import { familyFields, familySchema, validateFields, validateWorkflowFields, type ModuleData, type Family } from "./domain";

export const externalFamilies: Family[] = ["processos", "chamados", "ouvidoria", "esic", "seletivo", "projetos", "ambiental", "fiscalizacao"];
export type ExternalSession = NonNullable<Awaited<ReturnType<typeof getCitizenSession>>>;
export async function externalSession(req: Request) {
  const session = await getCitizenSession(req);
  if (!session) throw new ModuleError("Entre com sua conta e confirme o e-mail para continuar.", 401);
  return session;
}
// A representative is bound to a Firebase UID only after accepting with the verified invited email.
export function externalScope(session: ExternalSession, permission = "read") {
  return sql`(${moduleRecord.externalOwnerUid}=${session.uid} OR EXISTS (
    SELECT 1 FROM module_mandate m WHERE m.principal_uid=${moduleRecord.externalOwnerUid}
    AND m.representative_uid=${session.uid} AND m.accepted_at IS NOT NULL AND m.revoked_at IS NULL
    AND m.starts_at<=now() AND m.expires_at>now() AND m.permissions @> ${JSON.stringify([permission])}::jsonb
    AND m.families @> jsonb_build_array(${moduleRecord.family})
    AND (m.record_ids='[]'::jsonb OR m.record_ids @> jsonb_build_array(${moduleRecord.id}::text))))`;
}
// Rechecked inside the write statement; FOR SHARE serializes use with revocation.
export function externalWriteGate(row: ModuleRecord, session: ExternalSession, permission: string) {
  if (row.externalOwnerUid === session.uid) return sql`true`;
  return sql`EXISTS (SELECT 1 FROM module_mandate m WHERE m.principal_uid=${row.externalOwnerUid}
    AND m.representative_uid=${session.uid} AND m.accepted_at IS NOT NULL AND m.revoked_at IS NULL
    AND m.starts_at<=now() AND m.expires_at>now() AND m.permissions @> ${JSON.stringify([permission])}::jsonb
    AND m.families @> ${JSON.stringify([row.family])}::jsonb
    AND (m.record_ids='[]'::jsonb OR m.record_ids @> ${JSON.stringify([row.id])}::jsonb) FOR SHARE)`;
}
export async function ownedRecord(id: string, session: ExternalSession, permission = "read") {
  z.string().uuid().parse(id);
  const [row] = await db.select().from(moduleRecord).where(and(eq(moduleRecord.id, id), externalScope(session, permission)));
  if (!row) throw new ModuleError("Atendimento não encontrado ou autorização encerrada.", 404);
  return row;
}
export async function externalAudit(session: ExternalSession, action: string, id: string, metadata: Record<string, unknown> = {}) {
  await db.insert(auditLog).values({ actorType: "CITIZEN", actorId: session.uid, action, entityType: "module_record", entityId: id, metadata });
}
export function externalDto(row: ModuleRecord) {
  const allowedFields = new Set([...(familyFields[row.family as Family] ?? []).map(f => f.key), ...(row.data.workflow?.fields ?? []).map(f => f.key)]);
  return { id: row.id, code: row.code, family: row.family, title: row.title, body: row.body, status: row.status, revision: row.revision, createdAt: row.createdAt,
    values: Object.fromEntries(Object.entries(row.data.values ?? {}).filter(([key]) => allowedFields.has(key))), dueAt: row.data.dueAt, step: row.data.workflow?.steps[row.data.step ?? 0]?.name,
    messages: (row.data.messages ?? []).filter(m => m.visibility === "EXTERNA").map(m => ({ text: m.text, at: m.at, source: m.actorId === "INTERESSADO" ? "Interessado" : "Atendimento" })),
    requiredFiles: row.data.workflow?.requiredFiles ?? [], evaluation: row.data.evaluation,
    // Internal notes, signatures, linked documents, identity, actor IDs and versions are deliberately absent.
  };
}
export async function externalOptions() {
  const flows = await db.select().from(moduleRecord).where(and(eq(moduleRecord.family, "fluxos"), eq(moduleRecord.status, "ATIVO"), sql`${moduleRecord.data}->'values'->>'externalEnabled'='Sim'`));
  return flows.filter(f => externalFamilies.includes(f.data.workflow?.family as Family)).map(f => ({ id: f.id, title: f.title, description: f.body, family: f.data.workflow!.family, fields: f.data.workflow!.fields, requiredFiles: f.data.workflow!.requiredFiles }));
}
export async function listExternal(session: ExternalSession) {
  const rows = await db.select().from(moduleRecord).where(externalScope(session)).orderBy(desc(moduleRecord.updatedAt), desc(moduleRecord.id));
  return rows.map(r => ({ id: r.id, code: r.code, title: r.title, family: r.family, status: r.status, dueAt: r.data.dueAt ?? "", represented: r.externalOwnerUid !== session.uid }));
}
export async function externalDetail(id: string, session: ExternalSession) {
  const row = await ownedRecord(id, session);
  const files = await db.select({ id: moduleFile.id, filename: moduleFile.filename, category: moduleFile.category, size: moduleFile.size }).from(moduleFile)
    .where(and(eq(moduleFile.recordId, id), eq(moduleFile.externalVisible, true), externalFileVisibility(row))).orderBy(asc(moduleFile.createdAt));
  await externalAudit(session, "MODULE_EXTERNAL_READ", id, { represented: row.externalOwnerUid !== session.uid });
  return { record: externalDto(row), files, reviews: (row.data.files ?? []).filter(r => files.some(f => f.id === r.fileId)).map(r => ({ fileId: r.fileId, status: r.status, note: r.note, at: r.at })) };
}
export function externalFileVisibility(row: ModuleRecord) {
  const released = !["projetos", "ambiental", "fiscalizacao"].includes(row.family) || row.status === "DEFERIDO";
  return sql`(${moduleFile.externalActorUid} IS NOT NULL OR ${released})`;
}
const submission = z.object({ workflowId: z.string().uuid(), title: z.string().trim().min(3).max(250), body: z.string().trim().min(3).max(50000), values: z.record(z.string().max(20000)),
  name: z.string().trim().min(2).max(200), mandateId: z.string().uuid().optional(), idempotencyKey: z.string().uuid() });
export async function createExternal(input: unknown, session: ExternalSession) {
  const parsed = submission.parse(input);
  const [flow] = await db.select().from(moduleRecord).where(and(eq(moduleRecord.id, parsed.workflowId), eq(moduleRecord.family, "fluxos"), eq(moduleRecord.status, "ATIVO"), sql`${moduleRecord.data}->'values'->>'externalEnabled'='Sim'`));
  const workflow = flow?.data.workflow;
  if (!workflow || !externalFamilies.includes(workflow.family)) throw new ModuleError("Assunto indisponível para solicitação externa.");
  const [sector] = await db.select().from(department).where(and(eq(department.id, workflow.steps[0].departments[0]), eq(department.active, true)));
  if (!sector) throw new ModuleError("O setor responsável está indisponível.", 409);
  let ownerUid = session.uid; let ownerEmail = session.email; let grant: typeof moduleMandate.$inferSelect | undefined;
  if (parsed.mandateId) {
    [grant] = await db.select().from(moduleMandate).where(eq(moduleMandate.id, parsed.mandateId));
    if (!grant || grant.representativeUid !== session.uid || !grant.acceptedAt || grant.revokedAt || grant.startsAt > new Date() || grant.expiresAt <= new Date() || !grant.permissions.includes("create") || !grant.families.includes(workflow.family) || grant.recordIds.length) throw new ModuleError("Mandato não autoriza a abertura deste atendimento.", 403);
    ownerUid = grant.principalUid; ownerEmail = grant.principalEmail;
  }
  const allowedFields = new Set([...(familyFields[workflow.family] ?? []).map(f => f.key), ...workflow.fields.map(f => f.key)]);
  const values = Object.fromEntries(Object.entries(parsed.values).filter(([key]) => allowedFields.has(key)));
  try { validateFields(familyFields[workflow.family] ?? [], values); validateWorkflowFields(workflow, values); } catch (e) { throw new ModuleError((e as Error).message); }
  const hash = createHash("sha256").update(JSON.stringify({ ...parsed, values: Object.entries(values).sort(), actor: session.uid })).digest("hex");
  const [previous] = await db.select().from(moduleRecord).where(and(eq(moduleRecord.externalOwnerUid, ownerUid), eq(moduleRecord.idempotencyKey, parsed.idempotencyKey)));
  if (previous) { if (previous.data.syncHash !== hash) throw new ModuleError("Identificador já utilizado com outro conteúdo.", 409); return externalDto(await ownedRecord(previous.id, session)); }
  if (workflow.family === "ouvidoria" && !workflow.identityDepartmentId) throw new ModuleError("A Ouvidoria precisa configurar o setor responsável pela proteção de identidade.", 409);
  const data: ModuleData = { values, workflow, workflowId: flow.id, workflowRevision: flow.revision, step: 0, syncHash: hash, externalSubmission: true, identityDepartmentId: workflow.family === "ouvidoria" ? workflow.identityDepartmentId : sector.id };
  if (workflow.family !== "ouvidoria" || values.modalidade !== "Anônima") data.identity = { name: parsed.name, email: ownerEmail, cpfCnpj: "", phone: "" };
  validateBusiness(workflow.family, data);
  const email = workflow.family === "ouvidoria" && values.modalidade === "Anônima" ? null : ownerEmail;
  const guard = grant ? sql`EXISTS(SELECT 1 FROM module_mandate WHERE id=${grant.id}::uuid AND revoked_at IS NULL AND expires_at>now() AND starts_at<=now() AND representative_uid=${session.uid} FOR SHARE)` : sql`true`;
  const participants = Array.from(new Set([...workflow.steps[0].departments, ...(workflow.family === "ouvidoria" && workflow.identityDepartmentId ? [workflow.identityDepartmentId] : [])]));
  const result = await db.execute(sql`INSERT INTO module_record(family,title,body,status,department_id,participants,data,external_owner_uid,external_owner_email,external_actor_uid,idempotency_key,action)
    SELECT ${workflow.family},${parsed.title},${parsed.body},'RASCUNHO',${sector.id}::uuid,${JSON.stringify(participants)}::jsonb,${JSON.stringify(data)}::jsonb,${ownerUid},${email},${session.uid},${parsed.idempotencyKey},'RASCUNHO_EXTERNO'
    WHERE ${guard} ON CONFLICT DO NOTHING RETURNING id`);
  const id = result.rows[0]?.id as string | undefined;
  if (!id) {
    const [existing] = await db.select().from(moduleRecord).where(and(eq(moduleRecord.externalOwnerUid, ownerUid), eq(moduleRecord.idempotencyKey, parsed.idempotencyKey)));
    if (existing?.data.syncHash === hash) return externalDto(await ownedRecord(existing.id, session));
    throw new ModuleError("Solicitação já recebida ou autorização encerrada. Atualize a caixa.", 409);
  }
  return externalDto(await ownedRecord(id, session));
}
export async function externalCommand(id: string, input: unknown, session: ExternalSession) {
  const parsed = z.object({ revision: z.number().int().positive(), action: z.enum(["PROTOCOLAR", "RESPONDER", "AVALIAR"]), text: z.string().max(50000).default(""), score: z.number().int().min(1).max(5).optional() }).parse(input);
  const permission = parsed.action === "AVALIAR" ? "evaluate" : "reply";
  const row = await ownedRecord(id, session, permission);
  if (row.revision !== parsed.revision) throw new ModuleError("Atendimento atualizado. Recarregue antes de enviar.", 409);
  const data = structuredClone(row.data); let status = row.status;
  if (parsed.action === "PROTOCOLAR") {
    if (status !== "RASCUNHO" || !data.workflow) throw new ModuleError("Este atendimento já foi protocolado.", 409);
    const files = await db.select().from(moduleFile).where(eq(moduleFile.recordId, id));
    const missing = data.workflow.requiredFiles.filter(c => !files.some(f => f.category === c));
    if (missing.length) throw new ModuleError(`Envie os documentos obrigatórios: ${missing.join(", ")}.`);
    status = "EM_ANDAMENTO"; data.dueAt = await workflowDeadline(data.workflow.steps[0].hours, data.workflow.businessDays, data.workflow.steps[0].departments);
  } else if (parsed.action === "RESPONDER") {
    if (status !== "EM_ANDAMENTO" || !parsed.text.trim()) throw new ModuleError("Respostas exigem texto e atendimento em andamento.");
    data.messages = [...(data.messages ?? []), { actorId: "INTERESSADO", visibility: "EXTERNA", text: parsed.text.trim(), at: new Date().toISOString() }];
  } else {
    if (!["DEFERIDO", "INDEFERIDO", "CONCLUIDO", "ARQUIVADO"].includes(status) || parsed.score === undefined) throw new ModuleError("Avalie após a conclusão do atendimento.");
    data.evaluation = { score: parsed.score, comment: parsed.text, at: new Date().toISOString(), cycle: data.evaluationCycle ?? 0 };
  }
  const [updated] = await db.update(moduleRecord).set({ data, status, revision: row.revision + 1, actorId: null, externalActorUid: session.uid, action: `EXTERNO_${parsed.action}`, note: "" })
    .where(and(eq(moduleRecord.id, id), eq(moduleRecord.revision, row.revision), externalWriteGate(row, session, permission))).returning();
  if (!updated) throw new ModuleError("Atendimento atualizado ou autorização encerrada.", 409);
  return externalDto(updated);
}

export async function mandates(session: ExternalSession) {
  return db.select().from(moduleMandate).where(or(eq(moduleMandate.principalUid, session.uid), eq(moduleMandate.representativeUid, session.uid), and(sql`${moduleMandate.representativeUid} IS NULL`, eq(moduleMandate.representativeEmail, session.email)))).orderBy(desc(moduleMandate.createdAt));
}
export async function grantMandate(input: unknown, session: ExternalSession) {
  const value = z.object({ representativeEmail: z.string().email().transform(v => v.toLowerCase()), families: z.array(familySchema).min(1), recordIds: z.array(z.string().uuid()).default([]), permissions: z.array(z.enum(["read", "create", "reply", "upload", "evaluate"])).min(1), startsAt: z.string().datetime(), expiresAt: z.string().datetime(), consent: z.literal(true) }).parse(input);
  if (value.representativeEmail === session.email || new Date(value.expiresAt) <= new Date() || new Date(value.expiresAt) <= new Date(value.startsAt)) throw new ModuleError("Representante ou vigência inválidos.");
  if (value.families.some(f => !externalFamilies.includes(f))) throw new ModuleError("Módulo não admite representação externa.");
  if (!value.permissions.includes("read")) throw new ModuleError("A autorização exige permissão de consulta.");
  for (const id of value.recordIds) { const row = await ownedRecord(id, session); if (row.externalOwnerUid !== session.uid || !value.families.includes(row.family as Family)) throw new ModuleError("Você só pode conceder poderes sobre seus próprios atendimentos do escopo indicado.", 403); }
  const [mandate] = await db.insert(moduleMandate).values({ principalUid: session.uid, principalEmail: session.email, representativeEmail: value.representativeEmail, families: value.families, recordIds: value.recordIds, permissions: value.permissions,
    startsAt: new Date(value.startsAt), expiresAt: new Date(value.expiresAt), actorUid: session.uid,
    consent: "Autorizo expressamente o representante identificado a agir em meu nome nos módulos, atendimentos, poderes e período especificados. Posso revogar esta autorização a qualquer momento." }).returning();
  return mandate;
}
export async function changeMandate(id: string, action: string, session: ExternalSession) {
  z.string().uuid().parse(id); const [mandate] = await db.select().from(moduleMandate).where(eq(moduleMandate.id, id));
  if (!mandate || mandate.revokedAt) throw new ModuleError("Mandato indisponível.", 404);
  const accept = action === "ACEITAR";
  if (!accept && action !== "REVOGAR") throw new ModuleError("Ação inválida.");
  if (accept ? mandate.representativeEmail !== session.email || mandate.representativeUid !== null || mandate.expiresAt <= new Date() : mandate.principalUid !== session.uid && mandate.representativeUid !== session.uid) throw new ModuleError("Ação não autorizada.", 403);
  const [changed] = await db.update(moduleMandate).set(accept ? { representativeUid: session.uid, acceptedAt: new Date(), actorUid: session.uid, revision: mandate.revision + 1 } : { revokedAt: new Date(), actorUid: session.uid, revision: mandate.revision + 1 }).where(and(eq(moduleMandate.id, id), eq(moduleMandate.revision, mandate.revision))).returning();
  if (!changed) throw new ModuleError("Mandato atualizado por outra ação. Recarregue.", 409);
  return changed;
}
