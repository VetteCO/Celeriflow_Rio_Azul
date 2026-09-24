import { NextResponse } from "next/server";

// Callback Gov.br. Com MOCK (sem credencial) só registra evento para ensaio.
// Com credencial (CHECKPOINT 7), trocar por troca code->token + vínculo CPF.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("mock")) {
    return NextResponse.json({
      ok: true,
      mocked: true,
      message: "Login Gov.br MOCK — configure CHECKPOINT 7 para fluxo real (POC-02)"
    });
  }
  return NextResponse.json({ ok: false, error: "Gov.br não configurado" }, { status: 501 });
}
