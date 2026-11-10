import type { Session } from "./auth";
import type { document, documentMovement } from "@/db/schema";

type Document = typeof document.$inferSelect;
type Movement = typeof documentMovement.$inferSelect;
// A key is only a lookup token. Classification and ownership are checked separately.
export const publicDocumentAllowed = (doc: Pick<Document, "accessLevel">) => doc.accessLevel === "PUBLIC";
export const citizenDocumentAllowed = (doc: Pick<Document, "accessLevel" | "type">) =>
  doc.type === "EXTERNAL_REQUEST" && ["PUBLIC", "INTERNAL"].includes(doc.accessLevel);

const trackingActions = new Set(["CREATED", "FORWARDED", "RECEIVED", "CONCLUDED", "ARCHIVED", "REOPENED", "CITIZEN_REPLY", "CITIZEN_COMPLEMENT"]);
export function citizenHistory(moves: Movement[], authenticated = false) {
  return moves.filter(m => trackingActions.has(m.action) &&
    (!["CITIZEN_REPLY", "CITIZEN_COMPLEMENT"].includes(m.action) || m.visibility === "CITIZEN"))
    .map(m => ({ ...(authenticated ? { id: m.id } : {}), action: m.action, at: m.createdAt,
      ...(authenticated ? { note: m.visibility === "CITIZEN" ? m.note : null } : {}) }));
}
export function internalHistory(doc: Document, moves: Movement[], session: Session) {
  return moves.filter(m => m.visibility !== "CIRCULAR_RESTRICTED" || session.roles.includes("AUDITOR") ||
    m.actorUserId === session.userId || !!doc.originDepartmentId && session.departmentIds.includes(doc.originDepartmentId));
}
