import { db } from "@/db";
import { citizen, document, documentMovement, externalRequest } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { maskCpfCnpj } from "./mask";
import { formatNumber } from "./numbering";
export async function publicDocument(key: string) {
  if (key.length < 16 || key.length > 100) return null;
  const [doc] = await db.select().from(document).where(eq(document.publicKey, key));
  // Keys are not permission to publish internal/confidential documents.
  if (!doc || doc.accessLevel !== "PUBLIC") return null;
  const moves = await db.select().from(documentMovement).where(eq(documentMovement.documentId, doc.id)).orderBy(asc(documentMovement.createdAt), asc(documentMovement.id));
  const [request] = await db.select().from(externalRequest).where(eq(externalRequest.documentId, doc.id));
  const [person] = request ? await db.select().from(citizen).where(eq(citizen.id, request.citizenId)) : [];
  return { displayNumber: formatNumber(doc.type, doc.number, doc.year, doc.businessCode), type: doc.type, subject: doc.type === "EXTERNAL_REQUEST" ? "Requerimento externo" : "Documento público", status: doc.status, createdAt: doc.createdAt,
    protocolNumber: request?.protocolNumber ?? null, requestType: request ? "Requerimento externo" : null,
    citizenCpf: person ? maskCpfCnpj(person.cpfCnpj) : null,
    citizen: person ? { cpfCnpj: maskCpfCnpj(person.cpfCnpj) } : undefined,
    history: moves.filter(m => m.action !== "INTERNAL_NOTE").map(m => ({ action: m.action, at: m.createdAt })),
  };
}
