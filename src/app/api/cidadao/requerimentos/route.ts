// Requerimentos do cidadão (POC-07) — área pública, sem login.
// POST cria: citizen (upsert por CPF/CNPJ) + documento EXTERNAL_REQUEST +
// externalRequest (protocolo + publicKey) + e-mail de confirmação pendente.
// GET?key= acompanha o próprio protocolo (CPF mascarado, LGPD).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  auditLog,
  citizen,
  document,
  documentMovement,
  emailMessage,
  externalRequest,
} from "@/db/schema";
import { maskCpfCnpj } from "@/lib/mask";
import { createDocumentWithNumber, nextProtocolNumber } from "@/lib/numbering";
import { sendProcessEmail } from "@/lib/email";

const CreateSchema = z.object({
  name: z.string().min(3).max(200),
  cpfCnpj: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().min(11).max(14)),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional().default(""),
  cep: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().length(8)),
  street: z.string().max(300).optional().default(""),
  number: z.string().max(20),
  complement: z.string().max(100).optional().default(""),
  district: z.string().max(200).optional().default(""),
  city: z.string().max(200),
  state: z.string().length(2),
  requestType: z.string().min(3).max(200),
  description: z.string().min(10).max(10000),
});

export async function POST(req: Request) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "payload inválido", issues: parsed.error.issues },
      { status: 400 }
    );
  const b = parsed.data;
  const year = new Date().getFullYear();

  let person = (
    await db.select().from(citizen).where(eq(citizen.cpfCnpj, b.cpfCnpj))
  )[0];
  if (!person) {
    const inserted = await db
      .insert(citizen)
      .values({
        name: b.name,
        cpfCnpj: b.cpfCnpj,
        email: b.email,
        phone: b.phone || null,
        cep: b.cep,
        street: b.street || null,
        number: b.number,
        complement: b.complement || null,
        district: b.district || null,
        city: b.city,
        state: b.state,
      })
      .returning();
    person = inserted[0]!;
  }

  const replyToken = nanoid(21);
  const doc = await createDocumentWithNumber({
    type: "EXTERNAL_REQUEST",
    subject: `${b.requestType} — ${b.name}`,
    body: b.description,
    originDepartmentId: null,
    createdById: null,
  });
  const publicKey = doc.publicKey;

  // Reserva o protocolo com retry em conflito de unique.
  let protocol = "";
  let saved: typeof externalRequest.$inferSelect | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    protocol = await nextProtocolNumber();
    try {
      const inserted = await db
        .insert(externalRequest)
        .values({
          citizenId: person.id,
          documentId: doc.id,
          protocolNumber: protocol,
          publicKey,
          requestType: b.requestType,
        })
        .returning();
      saved = inserted[0]!;
      break;
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "23505" && attempt < 4) continue;
      throw e;
    }
  }
  if (!saved) return NextResponse.json({ error: "numbering_failed" }, { status: 500 });

  await db.insert(documentMovement).values({
    documentId: doc.id,
    fromDepartmentId: null,
    toDepartmentId: null,
    action: "CREATED",
    note: `Requerimento ${protocol} aberto pelo portal do cidadão`,
    actorUserId: null,
  });

  // Confirmação por e-mail: envia se Resend configurado; senão fica PENDENTE
  // (Fase 4 configura o envio real — nenhum e-mail é fingido).
  let emailStatus = "PENDING";
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    try {
      await sendProcessEmail({
        to: b.email,
        subject: `Protocolo ${protocol} recebido — Prefeitura de Rio Azul`,
        html: `<p>Olá, ${b.name}.</p><p>Seu requerimento <strong>${b.requestType}</strong> foi registrado sob protocolo <strong>${protocol}</strong>.</p><p>Acompanhe com a chave: <strong>${publicKey}</strong></p>`,
        replyToken,
      });
      emailStatus = "SENT";
    } catch {
      emailStatus = "FAILED";
    }
  }
  await db.insert(emailMessage).values({
    documentId: doc.id,
    direction: "OUTBOUND",
    providerMessageId: null,
    from: process.env.EMAIL_FROM ?? "pendente@configurar",
    to: b.email,
    subject: `Protocolo ${protocol} recebido`,
    bodyText: `Protocolo ${protocol}. Chave de acompanhamento: ${publicKey}`,
    bodyHtml: null,
    replyToken,
    status: emailStatus,
    sentAt: emailStatus === "SENT" ? new Date() : null,
    receivedAt: null,
  });

  await db.insert(auditLog).values({
    actorType: "CITIZEN",
    actorId: person.id,
    action: "EXTERNAL_REQUEST_CREATED",
    entityType: "external_request",
    entityId: saved.id,
    metadata: { protocol, emailStatus },
  });

  return NextResponse.json(
    { protocolNumber: protocol, publicKey, emailStatus },
    { status: 201 }
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") ?? "";
  if (!key) return NextResponse.json({ error: "key ausente" }, { status: 400 });

  const rows = await db.select().from(externalRequest).where(eq(externalRequest.publicKey, key));
  const er = rows[0];
  if (!er) return NextResponse.json({ error: "protocolo não encontrado" }, { status: 404 });
  const person = (await db.select().from(citizen).where(eq(citizen.id, er.citizenId)))[0];
  const docs = await db.select().from(document).where(eq(document.id, er.documentId));
  const moves = await db
    .select()
    .from(documentMovement)
    .where(eq(documentMovement.documentId, er.documentId));

  return NextResponse.json({
    protocolNumber: er.protocolNumber,
    requestType: er.requestType,
    status: docs[0]?.status ?? "—",
    createdAt: er.createdAt,
    citizen: {
      name: person?.name ?? "—",
      cpfCnpj: maskCpfCnpj(person?.cpfCnpj ?? ""),
    },
    history: moves.map((m) => ({ action: m.action, note: m.note, at: m.createdAt })),
  });
}
