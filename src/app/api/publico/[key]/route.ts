// DTO público (POC-03/09) — sem auth, só dados autorizados.
// Nunca serializa citizen/user interno: CPF mascarado, sem corpo, sem anexos,
// histórico limitado a ação+data (sem atores internos nem notas).
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  citizen,
  document,
  documentMovement,
  externalRequest,
} from "@/db/schema";
import { maskCpfCnpj } from "@/lib/mask";
import { formatNumber } from "@/lib/numbering";

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  // Chave pode ser publicKey do document OU do externalRequest (mesmo valor).
  const docs = await db.select().from(document).where(eq(document.publicKey, params.key));
  const doc = docs[0];
  if (!doc) return NextResponse.json({ error: "chave inválida" }, { status: 404 });

  const moves = await db
    .select()
    .from(documentMovement)
    .where(eq(documentMovement.documentId, doc.id))
    .orderBy(asc(documentMovement.createdAt));

  const base = {
    displayNumber: formatNumber(doc.type, doc.number, doc.year),
    type: doc.type,
    subject: doc.subject,
    status: doc.status,
    createdAt: doc.createdAt,
    history: moves.map((m) => ({ action: m.action, at: m.createdAt })),
  };

  if (doc.type === "EXTERNAL_REQUEST") {
    const ers = await db
      .select()
      .from(externalRequest)
      .where(eq(externalRequest.documentId, doc.id));
    const er = ers[0];
    const person = er
      ? (await db.select().from(citizen).where(eq(citizen.id, er.citizenId)))[0]
      : undefined;
    return NextResponse.json({
      ...base,
      protocolNumber: er?.protocolNumber ?? null,
      requestType: er?.requestType ?? null,
      citizenCpf: maskCpfCnpj(person?.cpfCnpj ?? ""),
    });
  }
  return NextResponse.json(base);
}
