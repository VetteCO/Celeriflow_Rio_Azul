// POC-08 — núcleo do inbound: roteamento por replyToken, idempotência,
// parser texto/HTML, anexos→Blob, despacho automático + timeline.
// Usado pelo webhook real (/api/email/inbound) e pelo simulador de ensaio.
import { eq } from "drizzle-orm";
import { Buffer } from "node:buffer";
import { db } from "@/db";
import {
  attachment,
  auditLog,
  document,
  documentMovement,
  emailMessage,
} from "@/db/schema";
import { uploadAttachment } from "@/lib/blob";

export type InboundPayload = {
  to: string;
  from: string;
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  attachments?: Array<{
    filename: string;
    contentType?: string;
    contentBase64: string;
  }>;
};

export function extractReplyToken(to: string): string | null {
  const m = to.match(/\+([A-Za-z0-9_-]{10,})@/);
  return m?.[1] ?? null;
}

// Remove resposta citada ("> ..."), bloco "Em ..., X escreveu:" e assinatura.
export function cleanReplyBody(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) continue;
    if (/escreveu:\s*$/.test(line)) break;
    if (/^--\s*$/.test(line)) break;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function processInbound(p: InboundPayload) {
  const token = extractReplyToken(p.to);
  if (!token) return { status: 404 as const, body: { error: "reply token ausente no destinatário" } };

  const outbound = (
    await db.select().from(emailMessage).where(eq(emailMessage.replyToken, token))
  )[0];
  if (!outbound || !outbound.documentId)
    return { status: 404 as const, body: { error: "token desconhecido" } };

  // Idempotência: mesmo Message-ID nunca gera 2 despachos.
  if (p.messageId) {
    const dup = (
      await db
        .select()
        .from(emailMessage)
        .where(eq(emailMessage.providerMessageId, p.messageId))
    )[0];
    if (dup) return { status: 200 as const, body: { ok: true, deduped: true } };
  }

  const bodyText = cleanReplyBody(p.text ?? "") || "(resposta sem texto extraído)";
  const inbound = (
    await db
      .insert(emailMessage)
      .values({
        documentId: outbound.documentId,
        direction: "INBOUND",
        providerMessageId: p.messageId ?? null,
        from: p.from,
        to: p.to,
        subject: p.subject ?? null,
        bodyText,
        bodyHtml: p.html ?? null,
        replyToken: null,
        status: "RECEIVED",
        sentAt: null,
        receivedAt: new Date(),
      })
      .returning()
  )[0]!;

  // Anexos → Blob + attachment.
  let files = 0;
  for (const a of p.attachments ?? []) {
    try {
      const buf = Buffer.from(a.contentBase64, "base64");
      if (buf.length === 0 || buf.length > 10 * 1024 * 1024) continue;
      const url = await uploadAttachment(a.filename, buf);
      await db.insert(attachment).values({
        documentId: outbound.documentId,
        filename: a.filename,
        mimeType: a.contentType ?? null,
        storageKey: url,
        size: buf.length,
      });
      files++;
    } catch {
      continue;
    }
  }

  // Despacho externo recebido + timeline (visível ao servidor sem toque manual).
  const mv = (
    await db
      .insert(documentMovement)
      .values({
        documentId: outbound.documentId,
        fromDepartmentId: null,
        toDepartmentId: null,
        action: "EXTERNAL_REPLY",
        note: `Resposta de ${p.from} por e-mail: ${bodyText.slice(0, 500)}${files > 0 ? ` (${files} anexo(s))` : ""}`,
        actorUserId: null,
      })
      .returning()
  )[0]!;

  await db.insert(auditLog).values({
    actorType: "EXTERNAL",
    actorId: p.from,
    action: "INBOUND_EMAIL_RECEIVED",
    entityType: "document",
    entityId: outbound.documentId,
    metadata: { messageId: p.messageId ?? null, attachments: files, movementId: mv.id },
  });

  return {
    status: 200 as const,
    body: { ok: true, documentId: outbound.documentId, movementId: mv.id, attachments: files },
  };
}
