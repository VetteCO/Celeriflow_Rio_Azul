import { configFamilies, type Family, type ModuleData } from "./domain";

type RecordState = { family: string; status: string; ownerId: string | null; departmentId: string | null; data: ModuleData };
type Actor = { userId: string; departmentIds: string[]; admin: boolean; writable: boolean };

/** Interface capabilities; the command handler remains the authority for every write. */
export function availableActions(row: RecordState, actor: Actor): string[] {
  if (!actor.writable || row.status === "PUBLICADO") return [];
  const family = row.family as Family, status = row.status, actions: string[] = [];
  if (configFamilies.includes(family) && !actor.admin) return [];
  if (family === "delegacoes" && row.ownerId !== actor.userId) return [];
  if (["RASCUNHO", "ATIVO", "SUSPENSO"].includes(status) && family !== "delegacoes") actions.push("EDITAR");
  if (status === "RASCUNHO") {
    if (configFamilies.includes(family) || ["contatos", "delegacoes"].includes(family)) actions.push("ATIVAR");
    else if (family !== "procuracoes") actions.push("PROTOCOLAR");
  }
  if (status === "ATIVO") actions.push("SUSPENDER");
  if (status === "SUSPENSO" && family !== "procuracoes") actions.push("ATIVAR");
  if (status === "EM_ANDAMENTO") {
    actions.push("RESPONDER", "REVISAR_ANEXO");
    const step = row.data.workflow?.steps[row.data.step ?? 0];
    if (step && step.departments.some(id => actor.departmentIds.includes(id))) {
      if (step.departments.some(id => actor.departmentIds.includes(id) && !row.data.completedDepartments?.includes(id))) actions.push("CONCLUIR_SETOR");
      if (step.departments.every(id => row.data.completedDepartments?.includes(id))) {
        if ((row.data.step ?? 0) < row.data.workflow!.steps.length - 1) actions.push("AVANCAR");
        else if (step.decision) actions.push("DEFERIR", "INDEFERIR");
      }
    }
    if (!row.data.workflow && ["ged", "parecer", "oficio", "atos"].includes(family)) actions.push("CONCLUIR");
    if (family === "intimacao") actions.push("CIENCIA");
    if (family === "pauta") actions.push("ENCERRAR_REUNIAO");
  }
  if (["DEFERIDO", "INDEFERIDO", "CIENTE", "CONCLUIDO", "CANCELADO"].includes(status)) actions.push("ARQUIVAR");
  if (["ARQUIVADO", "DEFERIDO", "INDEFERIDO"].includes(status) && row.departmentId && actor.departmentIds.includes(row.departmentId)) actions.push("REABRIR");
  if (row.ownerId === actor.userId && !["CANCELADO", "ARQUIVADO"].includes(status)) actions.push("CANCELAR");
  if (family === "diario" && status === "RASCUNHO") actions.push("PREPARAR_EDICAO");
  if (family === "diario" && actor.admin && status === "AGUARDANDO_ASSINATURA") actions.push("PUBLICAR");
  if (status !== "RASCUNHO") actions.push("SOLICITAR_ASSINATURA");
  if (row.data.signatures?.some(s => s.status === "PENDENTE")) {
    if (row.ownerId === actor.userId) actions.push("CANCELAR_ASSINATURAS");
    if (row.data.signatures.some(s => s.userId === actor.userId && s.status === "PENDENTE")) actions.push("RECUSAR_ASSINATURA");
  }
  return actions;
}
