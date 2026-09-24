import { NextResponse } from "next/server";

// POC-08 inbound: Resend/Mailgun chama este webhook quando cidadão responde.
// TODO Fase 4: validar INBOUND_WEBHOOK_SECRET, extrair replyToken,
// idempotência por providerMessageId, criar despacho + movement + anexo Blob.
export async function POST(req: Request) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = await req.json().catch(() => ({}));
  console.log("[inbound] recebido", JSON.stringify(payload).slice(0, 500));
  return NextResponse.json({ ok: true, mocked: true });
}
