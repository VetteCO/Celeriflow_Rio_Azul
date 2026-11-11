import { z } from "zod";
import type { ModuleData } from "./domain";

export const signatureFamilies = ["ged", "parecer", "oficio", "intimacao", "pauta", "atos"];
export const signatureStates = ["EM_ANDAMENTO", "CONCLUIDO", "CIENTE", "DEFERIDO"];
export const signersSchema = z.array(z.object({ userId: z.string().uuid(), order: z.number().int().min(1).max(100) })).min(1).max(100).superRefine((signers, ctx) => {
  if (new Set(signers.map(s => s.userId)).size !== signers.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cada assinante deve aparecer uma única vez." });
  const orders = [...new Set(signers.map(s => s.order))].sort((a, b) => a - b);
  if (orders.some((order, index) => order !== index + 1)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "As etapas de assinatura devem começar em 1 e não conter saltos. Use a mesma etapa para assinaturas simultâneas." });
});
export function canRequestSignature(row: { family: string; status: string; data: ModuleData }) {
  return signatureFamilies.includes(row.family) && signatureStates.includes(row.status) && !row.data.signatures?.some(s => s.status === "PENDENTE");
}
/** Canonical serialization shared by envelope generation and later cryptographic adapters. */
export function signatureContent(value: unknown): string {
  const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)])) : v;
  return JSON.stringify(normalize(value));
}
