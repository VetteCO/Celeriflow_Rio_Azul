// Numeração transacional de documentos: MEM-000001/2026.
// Lê MAX(number)+1 por (type, year) e insere; em conflito de unique
// (criação concorrente) tenta de novo. Nunca reutiliza número.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { document, externalRequest } from "@/db/schema";
import { nanoid } from "nanoid";

export type DocumentType = "MEMORANDUM" | "CIRCULAR" | "EXTERNAL_REQUEST" | "DISPATCH" | "OTHER";

const PREFIX: Record<DocumentType, string> = {
  MEMORANDUM: "MEM",
  CIRCULAR: "CIR",
  EXTERNAL_REQUEST: "REQ",
  DISPATCH: "DES",
  OTHER: "DOC",
};

export function formatNumber(type: DocumentType, number: number, year: number) {
  return `${PREFIX[type]}-${String(number).padStart(6, "0")}/${year}`;
}

async function nextCandidate(type: DocumentType, year: number) {
  const rows = await db
    .select({ max: sql<number | null>`max(${document.number})` })
    .from(document)
    .where(and(eq(document.type, type), eq(document.year, year)));
  return (rows[0]?.max ?? 0) + 1;
}

export async function createDocumentWithNumber(opts: {
  type: DocumentType;
  subject: string;
  body: string;
  originDepartmentId: string | null;
  createdById: string | null;
  toDepartmentId?: string | null;
}) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = await nextCandidate(opts.type, year);
    try {
      const inserted = await db
        .insert(document)
        .values({
          type: opts.type,
          number,
          year,
          subject: opts.subject,
          body: opts.body,
          status: "OPEN",
          originDepartmentId: opts.originDepartmentId,
          createdById: opts.createdById,
          publicKey: nanoid(21),
        })
        .returning();
      return inserted[0]!;
    } catch (e: unknown) {
      // 23505 = violou document_type_year_number_unique → outro request
      // pegou o mesmo número; tenta o próximo.
      const code = (e as { code?: string })?.code;
      if (code === "23505" && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error("numbering_failed");
}

// Protocolo do cidadão: AAAA-NNNNNN (sequencial por ano, sem reutilizar).
// A rota insere e, em violação do unique (23505), recalcula e tenta de novo.
export async function nextProtocolNumber() {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ max: sql<string | null>`max(${externalRequest.protocolNumber})` })
    .from(externalRequest);
  const maxSeq = rows[0]?.max ? parseInt(rows[0].max.split("-")[1] ?? "0", 10) : 0;
  const seq = (Number.isNaN(maxSeq) ? 0 : maxSeq) + 1;
  return `${year}-${String(seq).padStart(6, "0")}`;
}
