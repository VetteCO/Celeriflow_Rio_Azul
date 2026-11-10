import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appUser, department, auditLog } from "@/db/schema";
import { moduleRecord, moduleVersion, moduleFile, type ModuleRecord } from "@/db/modules-schema";
import { canAccessDocument, getSession, requirePerm } from "@/lib/auth";
import { blockSchema, configFamilies, familyFields, familySchema, processFamilies, workflowSchema, validateFields, validateWorkflowFields, validateGeometry, validTaxId, measureShape, type Family, type ModuleData } from "./domain";
import { canManage, canRead, redacted } from "./policy";
import { workflowDeadline } from "./business-hours";
import { validatePublication } from "./diary-catalog";
export { canRead, redacted } from "./policy";

export class ModuleError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function failure(error: unknown) {
  if (error instanceof ModuleError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return Response.json({ error: error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  const databaseCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (["P0001", "23505", "23503", "40001"].includes(databaseCode)) return Response.json({ error: "Os dados foram alterados, possuem vínculo incompatível ou estão fora do seu acesso. Atualize o cadastro e confira os vínculos antes de continuar." }, { status: 409 });
  console.error("[modules]", error);
  return Response.json({ error: "Não foi possível concluir a operação. Verifique a configuração e a disponibilidade do serviço." }, { status: 500 });
}
export async function context(req: Request, permission = "doc:view") {
  const session = await getSession(req);
  const access = requirePerm(session, permission);
  if (!access.ok || !session) throw new ModuleError("Acesso não autorizado.", access.ok ? 401 : access.status);
  const [user] = await db.select().from(appUser).where(and(eq(appUser.firebaseUid, session.uid), eq(appUser.active, true)));
  if (!user) throw new ModuleError("Servidor ativo não encontrado.", 403);
  return { user, session };
}
export type Context = Awaited<ReturnType<typeof context>>;
export function admin(ctx: Context) {
  if (!ctx.session.roles.includes("ADMIN_GERAL")) throw new ModuleError("A configuração exige Administrador Geral.", 403);
}
export function scope(ctx: Context) {
  // Configuration is readable to staff; document administration is not unrestricted reading.
  return or(inArray(moduleRecord.family, configFamilies), eq(moduleRecord.ownerId, ctx.user.id),
    sql`${moduleRecord.data}->'signatures' @> ${JSON.stringify([{ userId: ctx.user.id, status: "PENDENTE" }])}::jsonb`,
    and(eq(moduleRecord.family, "delegacoes"), sql`${moduleRecord.data}->'values'->>'digitador' = ${ctx.user.id}`),
    ctx.session.departmentIds.length ? and(sql`${moduleRecord.access} <> 'RESTRITO'`, or(inArray(moduleRecord.departmentId, ctx.session.departmentIds), ...ctx.session.departmentIds.map(id => sql`${moduleRecord.participants} @> ${JSON.stringify([id])}::jsonb`))) : sql`false`);
}
export async function getRecord(id: string, ctx: Context) {
  z.string().uuid().parse(id);
  const [row] = await db.select().from(moduleRecord).where(eq(moduleRecord.id, id));
  if (!row || !canRead(row, ctx)) throw new ModuleError("Registro não encontrado.", 404);
  return row;
}
export async function listRecords(family: string, ctx: Context) {
  const parsed = familySchema.parse(family);
  const rows = await db.select().from(moduleRecord).where(and(eq(moduleRecord.family, parsed), scope(ctx))).orderBy(desc(moduleRecord.updatedAt), desc(moduleRecord.id));
  // Keep sensitive form data out of operational lists entirely.
  return rows.map(row => ({ id: row.id, code: row.code, family: row.family, title: row.title, status: row.status, revision: row.revision, updatedAt: row.updatedAt, dueAt: row.data.dueAt ?? "" }));
}
const valuesSchema = z.record(z.string().max(20000)).refine(v => Object.keys(v).length <= 100, "Máximo de 100 campos.");
const identitySchema = z.object({ name: z.string().trim().min(2).max(200), email: z.string().email(), cpfCnpj: z.string().max(20).default("").refine(v => !v || validTaxId(v), "CPF/CNPJ inválido."), phone: z.string().max(30).default("") });
const inputSchema = z.object({
  title: z.string().trim().min(3).max(250), body: z.string().max(200000).default(""),
  values: valuesSchema.default({}), workflowId: z.string().uuid().optional(),
  workflow: workflowSchema.optional(), linkedIds: z.array(z.string().uuid()).max(100).default([]),
  coreDocumentIds: z.array(z.string().uuid()).max(100).default([]),
  identity: identitySchema.optional(), geometry: z.unknown().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]), classificationId: z.string().uuid().optional(),
  agenda: z.array(z.object({ title: z.string().min(1).max(500), responsible: z.string().max(200), decision: z.string().max(5000) })).max(100).default([]),
  attendees: z.array(z.string().max(200)).max(100).default([]),
  blocks: z.array(blockSchema).max(200).default([]),
  idempotencyKey: z.string().uuid().optional(),
});
async function checkLinks(ids: string[], ctx: Context) { for (const id of ids) await getRecord(id, ctx); }
async function checkCoreLinks(ids: string[], ctx: Context) {
  for (const id of ids) if (!await canAccessDocument(ctx.session, id)) throw new ModuleError("Documento vinculado não encontrado.", 404);
}
function safeValues(values: Record<string, string>, family: Family, previous: Record<string, string> = {}) {
  const result = { ...values };
  for (const key of ["autorizador", "delegacao", "usos", "cadastroPrincipal", ...(family === "delegacoes" ? [] : ["digitador"])]) {
    delete result[key]; if (previous[key] !== undefined) result[key] = previous[key];
  }
  return result;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
}
export function validateBusiness(family: Family, data: ModuleData) {
  const v = data.values ?? {};
  try { validateFields(familyFields[family] ?? [], v); } catch (e) { throw new ModuleError((e as Error).message); }
  if (family === "contatos" && !v.cpfCnpj && !v.email && !v.phone) throw new ModuleError("Informe CPF/CNPJ, e-mail ou telefone.");
  if (v.email && !z.string().email().safeParse(v.email).success) throw new ModuleError("E-mail inválido.");
  if (family === "parecer" && !data.linkedIds?.length && !data.coreDocumentIds?.length) throw new ModuleError("Vincule o parecer ao processo de origem.");
  if (family === "pauta" && !data.agenda?.length) throw new ModuleError("Inclua os itens da reunião.");
  if (family === "ouvidoria" && v.modalidade !== "Anônima" && !data.identity) throw new ModuleError("Informe a identificação do manifestante.");
  if (family === "fiscalizacao" && (Math.abs(Number(v.latitude)) > 90 || Math.abs(Number(v.longitude)) > 180)) throw new ModuleError("Coordenadas inválidas.");
  if (family === "projetos" && Number(v.areaTerreno) <= 0) throw new ModuleError("A área do terreno deve ser positiva.");
  if (family === "delegacoes" && (!z.string().uuid().safeParse(v.digitador).success || !Number.isInteger(Number(v.limite)) || Number(v.limite) < 1 || Number(v.limite) > 100)) throw new ModuleError("Informe um digitador válido e limite entre 1 e 100.");
}
export async function createRecord(familyInput: string, input: unknown, ctx: Context) {
  const family = familySchema.parse(familyInput);
  if (family === "contatos") {
    const { saveContact } = await import("./contacts");
    const saved = await saveContact(input, ctx);
    return redacted(await getRecord(String(saved.id), ctx), ctx);
  }
  if (configFamilies.includes(family)) admin(ctx);
  const parsed = inputSchema.parse(input);
  parsed.values = safeValues(parsed.values, family);
  const syncHash = createHash("sha256").update(JSON.stringify(canonical(parsed))).digest("hex");
  if (parsed.idempotencyKey) {
    const [existing] = await db.select().from(moduleRecord).where(and(eq(moduleRecord.ownerId, ctx.user.id), eq(moduleRecord.idempotencyKey, parsed.idempotencyKey)));
    if (existing) {
      if (existing.family !== family || existing.data.syncHash !== syncHash) throw new ModuleError("Identificador de sincronização já utilizado com outro conteúdo.", 409);
      return redacted(existing, ctx);
    }
  }
  await checkLinks(parsed.linkedIds, ctx);
  await checkCoreLinks(parsed.coreDocumentIds, ctx);
  let departmentId = ctx.user.departmentId;
  const data: ModuleData = { syncHash, values: parsed.values, linkedIds: parsed.linkedIds, coreDocumentIds: parsed.coreDocumentIds, tags: parsed.tags, classificationId: parsed.classificationId, agenda: parsed.agenda, attendees: parsed.attendees, blocks: parsed.blocks };
  if (parsed.classificationId) { const c = await getRecord(parsed.classificationId, ctx); if (c.family !== "classificacao") throw new ModuleError("Classificação inválida."); }
  if (family === "fluxos") {
    data.workflow = workflowSchema.parse(parsed.workflow);
    const ids = Array.from(new Set([...data.workflow.steps.flatMap(s => s.departments), ...(data.workflow.routingDepartments??[]), ...(data.workflow.identityDepartmentId ? [data.workflow.identityDepartmentId] : [])]));
    const sectors = await db.select().from(department).where(and(inArray(department.id, ids), eq(department.active, true)));
    if (sectors.length !== ids.length) throw new ModuleError("O fluxo contém setores inativos ou inexistentes.");
    if (data.workflow.family === "pessoal" && (!data.workflow.rhDepartmentId || ids.some(id => id !== data.workflow!.rhDepartmentId))) throw new ModuleError("Requerimentos pessoais devem tramitar exclusivamente no RH configurado.");
    if (data.workflow.family === "ouvidoria" && !data.workflow.identityDepartmentId) throw new ModuleError("Defina o setor da Ouvidoria responsável pela identidade do manifestante.");
  }
  if (parsed.workflowId) {
    const workflow = await getRecord(parsed.workflowId, ctx);
    if (workflow.family !== "fluxos" || workflow.status !== "ATIVO" || workflow.data.workflow?.family !== family) throw new ModuleError("Selecione um fluxo ativo compatível com o módulo.");
    data.workflow = workflow.data.workflow; data.workflowId = workflow.id; data.workflowRevision = workflow.revision; data.step = 0;
    departmentId = data.workflow.steps[0].departments[0];
  }
  if (processFamilies.includes(family) && !data.workflow) throw new ModuleError("Configure e selecione um assunto/fluxo para este atendimento.");
  if (family === "ouvidoria") {
    if (!data.workflow?.identityDepartmentId) throw new ModuleError("O fluxo precisa indicar o setor da Ouvidoria responsável pela identidade.");
    data.identityDepartmentId = data.workflow.identityDepartmentId;
    if (parsed.values.modalidade !== "Anônima") data.identity = parsed.identity;
  }
  if (family === "camadas") { try { data.geometry = validateGeometry(parsed.geometry); } catch (e) { throw new ModuleError((e as Error).message); } }
  if (family === "delegacoes") data.values = { ...data.values, usos: "0", autorizador: ctx.user.id };
  validateBusiness(family, data);
  const participants = Array.from(new Set([...(data.workflow?.steps[0]?.departments ?? (departmentId ? [departmentId] : [])), ...(family === "ouvidoria" && data.identityDepartmentId ? [data.identityDepartmentId] : [])]));
  const [created] = await db.insert(moduleRecord).values({ family, title: parsed.title, body: parsed.body, ownerId: ctx.user.id, actorId: ctx.user.id, departmentId, participants, data, access: family === "delegacoes" ? "RESTRITO" : "SETOR", idempotencyKey: parsed.idempotencyKey }).onConflictDoNothing().returning();
  if (!created) {
    if (parsed.idempotencyKey) {
      const [existing] = await db.select().from(moduleRecord).where(and(eq(moduleRecord.ownerId, ctx.user.id), eq(moduleRecord.idempotencyKey, parsed.idempotencyKey)));
      if (existing?.family === family && existing.data.syncHash === syncHash) return redacted(existing, ctx);
    }
    throw new ModuleError("Registro já recebido. Atualize a listagem.", 409);
  }
  return redacted(created, ctx);
}

const commandSchema = z.object({ revision: z.number().int().positive(), action: z.enum(["EDITAR", "ATIVAR", "SUSPENDER", "PROTOCOLAR", "CONCLUIR_SETOR", "AVANCAR", "DEFERIR", "INDEFERIR", "RESPONDER", "CIENCIA", "ENCERRAR_REUNIAO", "SOLICITAR_ASSINATURA", "RECUSAR_ASSINATURA", "CANCELAR_ASSINATURAS", "REVISAR_ANEXO", "MEDIR", "PREPARAR_EDICAO", "PUBLICAR", "SOLICITAR_PROCESSAMENTO", "CANCELAR", "ARQUIVAR", "REABRIR", "UNIFICAR_CONTATO", "CONCLUIR", "CLASSIFICAR"]), payload: z.record(z.unknown()).default({}), note: z.string().trim().max(10000).default("") });
export async function command(id: string, input: unknown, ctx: Context) {
  const cmd = commandSchema.parse(input); const row = await getRecord(id, ctx);
  const family = row.family as Family;
  if (configFamilies.includes(family)) admin(ctx);
  else if (cmd.action !== "RECUSAR_ASSINATURA" && !canManage(row, ctx)) throw new ModuleError("Você pode consultar, mas não alterar este registro.", 403);
  if (family === "delegacoes" && row.ownerId !== ctx.user.id) throw new ModuleError("Somente o autorizador pode alterar a delegação.", 403);
  if (row.revision !== cmd.revision) throw new ModuleError("O registro foi alterado por outro servidor. Recarregue antes de salvar.", 409);
  if (row.status === "PUBLICADO") throw new ModuleError("A publicação é imutável.", 409);
  const data = structuredClone(row.data); let status = row.status; let body = row.body; let title = row.title;
  let participants = row.participants; let departmentId = row.departmentId;
  const now = new Date().toISOString();
  const payload = cmd.payload;
  const active = () => { if (row.status !== "EM_ANDAMENTO") throw new ModuleError("A operação exige registro em andamento."); };
  const stage = () => {
    active(); const step = data.workflow?.steps[data.step ?? 0];
    if (!step || !ctx.session.departmentIds.some(id => step.departments.includes(id))) throw new ModuleError("Ação restrita aos setores da etapa atual.", 403);
    return step;
  };
  switch (cmd.action) {
    case "EDITAR": {
      if (family === "contatos") {
        const { saveContact } = await import("./contacts");
        await saveContact({ ...payload, revision: cmd.revision }, ctx, id);
        return redacted(await getRecord(id, ctx), ctx);
      }
      if (!["RASCUNHO", "ATIVO", "SUSPENSO"].includes(status)) throw new ModuleError("O conteúdo já foi formalizado. Registre uma resposta.");
      const parsed = inputSchema.parse(payload); await checkLinks(parsed.linkedIds, ctx);
      await checkCoreLinks(parsed.coreDocumentIds, ctx);
      parsed.values = safeValues(parsed.values, family, data.values);
      title = parsed.title; body = parsed.body;
      Object.assign(data, { values: parsed.values, linkedIds: parsed.linkedIds, coreDocumentIds: parsed.coreDocumentIds, tags: parsed.tags, classificationId: parsed.classificationId, agenda: parsed.agenda, attendees: parsed.attendees, blocks: parsed.blocks });
      if (family === "delegacoes") throw new ModuleError("Cancele a delegação e crie nova autorização para alterar limites.");
      if (family === "fluxos") { data.workflow = workflowSchema.parse(parsed.workflow); status = "RASCUNHO"; }
      if (family === "camadas") { try { data.geometry = validateGeometry(parsed.geometry); } catch (e) { throw new ModuleError((e as Error).message); } }
      if (family === "ouvidoria") {
        if (!ctx.session.departmentIds.includes(data.identityDepartmentId ?? "")) throw new ModuleError("Identificação restrita à Ouvidoria.", 403);
        data.identity = parsed.values.modalidade === "Anônima" ? undefined : parsed.identity;
      }
      validateBusiness(family, data); break;
    }
    case "ATIVAR":
      if (!configFamilies.includes(family) && !["contatos", "procuracoes", "delegacoes"].includes(family)) throw new ModuleError("Este registro deve ser protocolado.");
      if (!["RASCUNHO", "SUSPENSO"].includes(status)) throw new ModuleError("Situação incompatível.");
      if (family === "procuracoes") throw new ModuleError("A validação da procuração depende da assinatura e identificação dos outorgantes.", 409);
      if (family === "delegacoes") {
        const [digitador] = await db.select().from(appUser).where(and(eq(appUser.id, data.values!.digitador), eq(appUser.active, true)));
        if (!digitador || new Date(`${data.values!.validade}T23:59:59-03:00`) <= new Date()) throw new ModuleError("Digitador inativo ou delegação vencida.");
      }
      if (family === "fluxos") {
        const workflow = workflowSchema.parse(data.workflow);
        const ids = Array.from(new Set([...workflow.steps.flatMap(s => s.departments), ...(workflow.routingDepartments??[]), ...(workflow.identityDepartmentId ? [workflow.identityDepartmentId] : [])]));
        const sectors = await db.select().from(department).where(and(inArray(department.id, ids), eq(department.active, true)));
        if (sectors.length !== ids.length) throw new ModuleError("Há setores inativos ou inexistentes no fluxo.");
        if (workflow.family === "pessoal" && (!workflow.rhDepartmentId || ids.some(x => x !== workflow.rhDepartmentId))) throw new ModuleError("Fluxo pessoal deve permanecer no RH.");
        if (workflow.family === "ouvidoria" && !workflow.identityDepartmentId) throw new ModuleError("Defina o setor da Ouvidoria responsável pela identidade.");
        if (new Set(workflow.fields.map(f => f.key)).size !== workflow.fields.length) throw new ModuleError("Chaves de campo duplicadas.");
      }
      status = "ATIVO"; break;
    case "SUSPENDER": if (status !== "ATIVO") throw new ModuleError("Registro não está ativo."); status = "SUSPENSO"; break;
    case "PROTOCOLAR": {
      if (configFamilies.includes(family) || status !== "RASCUNHO") throw new ModuleError("Registro não pode ser protocolado nesta situação.");
      validateBusiness(family, data);
      if (data.workflow) {
        try { validateWorkflowFields(data.workflow, data.values ?? {}); } catch (e) { throw new ModuleError((e as Error).message); }
        const files = await db.select().from(moduleFile).where(eq(moduleFile.recordId, id));
        const missing = data.workflow.requiredFiles.filter(category => !files.some(f => f.category === category));
        if (missing.length) throw new ModuleError(`Anexos obrigatórios: ${missing.join(", ")}.`);
        data.dueAt = await workflowDeadline(data.workflow.steps[0].hours, data.workflow.businessDays, data.workflow.steps[0].departments);
      }
      status = "EM_ANDAMENTO"; break;
    }
    case "CONCLUIR_SETOR": { const step = stage(); const target = z.string().uuid().parse(payload.departmentId ?? ctx.user.departmentId); if (!ctx.session.departmentIds.includes(target) || !step.departments.includes(target)) throw new ModuleError("Setor fora de sua atuação.", 403); data.completedDepartments = Array.from(new Set([...(data.completedDepartments ?? []), target])); break; }
    case "AVANCAR": {
      const step = stage();
      if (!step.departments.every(d => data.completedDepartments?.includes(d))) throw new ModuleError("Todos os setores devem concluir sua participação antes do avanço.");
      const next = (data.step ?? 0) + 1; const nextStep = data.workflow!.steps[next];
      if (!nextStep) throw new ModuleError("Última etapa: registre a decisão final.");
      data.step = next; data.completedDepartments = []; data.dueAt = await workflowDeadline(nextStep.hours, data.workflow!.businessDays, nextStep.departments);
      participants = Array.from(new Set([...participants, ...nextStep.departments])); departmentId = nextStep.departments[0]; break;
    }
    case "DEFERIR": case "INDEFERIR": {
      const step = stage();
      if (!step.decision || (data.step ?? 0) !== data.workflow!.steps.length - 1) throw new ModuleError("A decisão exige a última etapa configurada para decidir.");
      if (!step.departments.every(d => data.completedDepartments?.includes(d))) throw new ModuleError("Conclua todas as participações da etapa.");
      if (!cmd.note) throw new ModuleError("Informe a fundamentação da decisão.");
      status = cmd.action === "DEFERIR" ? "DEFERIDO" : "INDEFERIDO";
      if (data.externalSubmission) data.messages = [...(data.messages ?? []), { actorId: ctx.user.id, visibility: "EXTERNA", text: `${status === "DEFERIDO" ? "Pedido deferido" : "Pedido indeferido"}: ${cmd.note}`, at: now }];
      break;
    }
    case "RESPONDER": {
      active(); const message = z.object({ text: z.string().trim().min(1).max(50000), visibility: z.enum(["INTERNA", "EXTERNA"]) }).parse(payload);
      data.messages = [...(data.messages ?? []), { ...message, actorId: ctx.user.id, at: now }]; break;
    }
    case "CIENCIA": {
      active(); if (family !== "intimacao") throw new ModuleError("Ação exclusiva de intimações.");
      const evidence = z.object({ recipient: z.string().min(2).max(200), evidence: z.string().min(5).max(5000) }).parse(payload);
      data.acknowledgements = [...(data.acknowledgements ?? []), { ...evidence, at: now, actorId: ctx.user.id }]; status = "CIENTE"; break;
    }
    case "ENCERRAR_REUNIAO": {
      active(); if (family !== "pauta") throw new ModuleError("Ação exclusiva de reuniões.");
      const agenda = inputSchema.shape.agenda.parse(payload.agenda);
      if (!agenda.length || agenda.some(i => !i.decision.trim())) throw new ModuleError("Registre deliberação para cada item.");
      data.agenda = agenda; status = "CONCLUIDO"; break;
    }
    case "SOLICITAR_ASSINATURA": {
      if (status === "RASCUNHO") throw new ModuleError("Formalize o documento antes de solicitar assinatura.");
      const signers = z.array(z.object({ userId: z.string().uuid(), order: z.number().int().min(1).max(100) })).min(1).max(100).parse(payload.signers);
      const users = await db.select().from(appUser).where(and(inArray(appUser.id, signers.map(s => s.userId)), eq(appUser.active, true)));
      if (users.length !== new Set(signers.map(s => s.userId)).size) throw new ModuleError("Assinante inativo ou inexistente.");
      data.signatures = signers.map(s => ({ ...s, status: "PENDENTE", revision: row.revision }));
      data.sealedHash = createHash("sha256").update(JSON.stringify({ title, body, blocks: data.blocks, revision: row.revision })).digest("hex"); break;
    }
    case "RECUSAR_ASSINATURA": {
      if (!cmd.note) throw new ModuleError("Informe o motivo da recusa.");
      if (!data.signatures?.some(s => s.userId === ctx.user.id && s.status === "PENDENTE")) throw new ModuleError("Não há assinatura pendente para você.");
      data.signatures = data.signatures.map(s => s.userId === ctx.user.id && s.status === "PENDENTE" ? { ...s, status: "RECUSADA", reason: cmd.note } : s); break;
    }
    case "CANCELAR_ASSINATURAS":
      if (row.ownerId !== ctx.user.id || !cmd.note) throw new ModuleError("Somente o solicitante pode cancelar, com justificativa.", 403);
      data.signatures = data.signatures?.map(s => s.status === "PENDENTE" ? { ...s, status: "CANCELADA", reason: cmd.note } : s); break;
    case "REVISAR_ANEXO": {
      active(); const review = z.object({ fileId: z.string().uuid(), status: z.enum(["ACEITO", "RECUSADO"]), note: z.string().max(5000) }).parse(payload);
      const [file] = await db.select().from(moduleFile).where(and(eq(moduleFile.id, review.fileId), eq(moduleFile.recordId, id)));
      if (!file) throw new ModuleError("Anexo não encontrado.", 404);
      if (review.status === "RECUSADO" && !review.note.trim()) throw new ModuleError("Justifique a recusa.");
      data.files = [...(data.files ?? []), { ...review, actorId: ctx.user.id, at: now }]; break;
    }
    case "MEDIR": {
      const measurement = z.object({ fileId: z.string().uuid(), page: z.number().int().positive(), scale: z.number().positive(), type: z.enum(["distancia", "area"]), points: z.array(z.array(z.number().finite()).length(2)).min(2).max(1000), shape: z.enum(["polyline", "polygon", "rectangle", "ellipse"]), coordinateSystem: z.literal("PDF_VIEWPORT_POINTS"), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), width: z.number().min(0.5).max(10), opacity: z.number().min(0.1).max(1), precision: z.number().int().min(0).max(4), fileHash: z.string().length(64) }).parse(payload);
      const [file] = await db.select().from(moduleFile).where(and(eq(moduleFile.id, measurement.fileId), eq(moduleFile.recordId, id)));
      if (!file || file.mimeType !== "application/pdf") throw new ModuleError("Selecione uma planta PDF deste processo.");
      if (file.sha256 !== measurement.fileHash) throw new ModuleError("A medição não corresponde ao original selecionado.", 409);
      if ((measurement.type === "distancia") !== (measurement.shape === "polyline")) throw new ModuleError("Forma incompatível com o tipo de medição.");
      data.measurements = [...(data.measurements ?? []), { ...measurement, result: measureShape(measurement.points, measurement.scale, measurement.type, measurement.shape) }]; break;
    }
    case "PREPARAR_EDICAO": {
      if (family !== "diario" || status !== "RASCUNHO") throw new ModuleError("Selecione uma edição em preparação.");
      const ids = z.array(z.string().uuid()).min(1).max(100).parse(payload.actIds);
      const acts = await Promise.all(ids.map(id => getRecord(id, ctx)));
      if (acts.some(a => a.family !== "atos" || a.status === "RASCUNHO")) throw new ModuleError("A edição exige atos formalizados.");
      data.publication = acts.map(a => ({ id: a.id, code: a.code, title: a.title, body: a.body, blocks: a.data.blocks, revision: a.revision, section: data.values?.caderno ?? "" }));
      data.sealedHash = createHash("sha256").update(JSON.stringify(data.publication)).digest("hex"); status = "AGUARDANDO_ASSINATURA"; break;
    }
    case "PUBLICAR": {
      admin(ctx);
      if (family !== "diario" || status !== "AGUARDANDO_ASSINATURA" || !data.publication?.some(a=>!a.withdrawn)) throw new ModuleError("Prepare a edição com ao menos um ato ativo antes de publicar.");
      z.object({ mode: z.literal("INFORMATIVA"), acknowledgeUnsigned: z.literal(true) }).parse(payload);
      await validatePublication(data.publication);
      data.publicationMode = "INFORMATIVA"; data.publishedAt = now; status = "PUBLICADO"; break;
    }
    case "SOLICITAR_PROCESSAMENTO": {
      const kind = z.enum(["OCR", "ARVORE_PDF", "ANEXOS_ZIP", "PDF_A", "SISOBRA_ENVIO", "SISOBRA_RETIFICACAO", "SISOBRA_CANCELAMENTO", "SISOBRA_REATIVACAO"]).parse(payload.kind);
      data.jobs = [...(data.jobs ?? []), { id: randomUUID(), kind, status: "AGUARDANDO_CONFIGURACAO", at: now }]; break;
    }
    case "CANCELAR": if (!cmd.note || row.ownerId !== ctx.user.id) throw new ModuleError("Cancelamento exige o autor e justificativa.", 403); status = "CANCELADO"; break;
    case "UNIFICAR_CONTATO": {
      if (family !== "contatos") throw new ModuleError("Selecione um contato.");
      const { mergeContacts } = await import("./contacts");
      await mergeContacts({ sourceId: id, sourceRevision: cmd.revision, targetId: payload.targetId, targetRevision: payload.targetRevision }, ctx);
      return redacted(await getRecord(id, ctx), ctx);
    }
    case "CONCLUIR": {
      active();
      if (!["ged", "parecer", "oficio", "atos"].includes(family) || data.workflow) throw new ModuleError("Conclua o fluxo específico deste módulo.");
      if (!cmd.note) throw new ModuleError("Informe a justificativa de conclusão.");
      status = "CONCLUIDO"; break;
    }
    case "CLASSIFICAR": {
      const classification = await getRecord(z.string().uuid().parse(payload.classificationId), ctx);
      if (classification.family !== "classificacao" || classification.status !== "ATIVO") throw new ModuleError("Selecione uma classificação ativa.");
      data.classificationId = classification.id;
      data.tags = z.array(z.string().min(1).max(60)).max(30).parse(payload.tags ?? data.tags ?? []); break;
    }
    case "ARQUIVAR": if (!["CONCLUIDO", "CIENTE", "DEFERIDO", "INDEFERIDO", "CANCELADO"].includes(status)) throw new ModuleError("Conclua o fluxo antes de arquivar."); status = "ARQUIVADO"; break;
    case "REABRIR": if (!["ARQUIVADO", "DEFERIDO", "INDEFERIDO"].includes(status) || !cmd.note) throw new ModuleError("Informe justificativa para reabrir registro concluído."); stageForReopen(row, ctx); status = "EM_ANDAMENTO"; data.completedDepartments = []; break;
  }
  if (cmd.action === "REABRIR") { data.evaluationCycle = (data.evaluationCycle ?? 0) + 1; delete data.evaluation; }
  const leaseGate = cmd.action === "EDITAR" ? sql`EXISTS(SELECT 1 FROM module_edit_lease WHERE record_id=${id}::uuid AND actor_id=${ctx.user.id}::uuid AND expires_at>now() AND token_hash=${createHash("sha256").update(z.string().min(32).parse(payload.leaseToken)).digest("hex")} FOR SHARE)` : sql`true`;
  const [updated] = await db.update(moduleRecord).set({ title, body, data, status, participants, departmentId, access: cmd.action === "PUBLICAR" ? "PUBLICO" : row.access, revision: row.revision + 1, actorId: ctx.user.id, externalActorUid: null, action: cmd.action, note: cmd.note }).where(and(eq(moduleRecord.id, id), eq(moduleRecord.revision, cmd.revision),leaseGate)).returning();
  if (!updated) throw new ModuleError("Conflito de edição. Recarregue o registro.", 409);
  return redacted(updated, ctx);
}
function stageForReopen(row: ModuleRecord, ctx: Context) {
  if (!row.departmentId || !ctx.session.departmentIds.includes(row.departmentId)) throw new ModuleError("Somente o setor responsável pode reabrir.", 403);
}
export async function detail(id: string, ctx: Context) {
  const row = await getRecord(id, ctx);
  const [versions, files] = await Promise.all([
    db.select().from(moduleVersion).where(eq(moduleVersion.recordId, id)).orderBy(asc(moduleVersion.revision)),
    db.select({ id: moduleFile.id, filename: moduleFile.filename, category: moduleFile.category, mimeType: moduleFile.mimeType, size: moduleFile.size, sha256: moduleFile.sha256, createdAt: moduleFile.createdAt }).from(moduleFile).where(eq(moduleFile.recordId, id)).orderBy(asc(moduleFile.createdAt)),
  ]);
  await db.insert(auditLog).values({ actorType: "USER", actorId: ctx.user.id, action: "MODULE_READ", entityType: row.family, entityId: id });
  return { record: redacted(row, ctx), files, versions: versions.map(v => ({ id: v.id, revision: v.revision, action: v.action, note: v.note, actorId: v.actorId, createdAt: v.createdAt })), permissions: { edit: requirePerm(ctx.session, "doc:edit").ok && (!configFamilies.includes(row.family as Family) || ctx.session.roles.includes("ADMIN_GERAL")) } };
}
