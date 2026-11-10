// POC-08 inbound real: o provedor de e-mail (Resend/MX próprio) chama este
// webhook quando o cidadão responde. Formato aceito:
// { to: "processo+<replyToken>@dominio", from, subject?, text?, html?,
//   messageId?, attachments?: [{filename, contentType?, contentBase64}] }
// Auth: header x-webhook-secret == INBOUND_WEBHOOK_SECRET (quando configurado).
import { NextResponse } from "next/server";
import { processInbound, type InboundPayload } from "@/lib/inbound";

export async function POST(req: Request) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Recebimento de e-mail indisponível." }, { status: 503 });
  }
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = (await req.json().catch(() => null)) as InboundPayload | null;
  if (!payload?.to || !payload?.from) {
    return NextResponse.json(
      { error: "payload inválido (to/from obrigatórios)" },
      { status: 400 }
    );
  }
  const { status, body } = await processInbound(payload);
  return NextResponse.json(body, { status });
}
