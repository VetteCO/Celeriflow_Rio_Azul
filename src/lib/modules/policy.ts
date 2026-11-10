import type { ModuleRecord } from "@/db/modules-schema";
import { configFamilies, type Family } from "./domain";
export type ScopeContext = { user: { id: string }; session: { departmentIds: string[] } };
export function canManage(row: ModuleRecord, ctx: ScopeContext) {
  return row.ownerId === ctx.user.id || row.access !== "RESTRITO" && ctx.session.departmentIds.some(id => row.departmentId === id || row.participants.includes(id));
}
export function canRead(row: ModuleRecord, ctx: ScopeContext) {
  if (configFamilies.includes(row.family as Family)) return true;
  if (row.ownerId === ctx.user.id) return true;
  if (row.data.signatures?.some(s => s.userId === ctx.user.id && s.status === "PENDENTE")) return true;
  if (row.family === "delegacoes" && row.data.values?.digitador === ctx.user.id) return true;
  return row.access !== "RESTRITO" && ctx.session.departmentIds.some(id => row.departmentId === id || row.participants.includes(id));
}
export function redacted(row: ModuleRecord, ctx: ScopeContext) {
  const result = structuredClone(row);
  if (row.family === "ouvidoria" && row.data.values?.modalidade === "Sigilosa" && !ctx.session.departmentIds.includes(row.data.identityDepartmentId ?? "")) delete result.data.identity;
  if (row.family === "ouvidoria" && (row.data.values?.modalidade === "Anônima" || row.data.values?.modalidade === "Sigilosa" && !ctx.session.departmentIds.includes(row.data.identityDepartmentId ?? ""))) {
    result.externalOwnerEmail = null; result.externalOwnerUid = null; result.externalActorUid = null;
  }
  return result;
}
