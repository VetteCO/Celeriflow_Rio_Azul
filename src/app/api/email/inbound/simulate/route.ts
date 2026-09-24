// Simulador de ensaio do inbound (POC-08) — ADMIN_GERAL apenas.
// Executa o MESMO processInbound do webhook real, com payload montado aqui.
// Uso: validar o fluxo ponta a ponta antes do domínio/MX próprio existir.
// NÃO é o caminho de produção: em produção o provedor chama /api/email/inbound.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { document, emailMessage } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { processInbound } from "@/lib/inbound";

const Schema = z.object({
  documentId: z.string().uuid(),
  from: z.string().email().optional().default("cidadao.demo@email.com"),
  text: z
    .string()
    .min(1)
    .max(10000)
    .optional()
    .default(
      "Segue a resposta ao processo.\n\n> Em resposta ao e-mail da Prefeitura (citado, ignorado no despacho)."
    ),
});

export async function POST(req: Request) {
  const session = await getSession(req);
  const check = requirePerm(session, "admin:users");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const docs = await db
    .select()
    .from(document)
    .where(eq(document.id, parsed.data.documentId));
  if (!docs[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const outbound = (
    await db
      .select()
      .from(emailMessage)
      .then((rows) =>
        rows.find((m) => m.documentId === parsed.data.documentId && m.replyToken)
      )
  );
  if (!outbound?.replyToken)
    return NextResponse.json(
      { error: "documento sem e-mail de saída com replyToken" },
      { status: 409 }
    );

  const { status, body } = await processInbound({
    to: `processo+${outbound.replyToken}@simulador.ensaio`,
    from: parsed.data.from,
    subject: `Re: Protocolo (simulação de ensaio)`,
    text: parsed.data.text,
    messageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  return NextResponse.json({ ...body, simulated: true }, { status });
}
