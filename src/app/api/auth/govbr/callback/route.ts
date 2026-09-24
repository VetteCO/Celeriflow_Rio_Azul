import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

// Callback Gov.br (POC-02).
// - Homologação (sem credencial de produção): recebe cpf+name da tela de
//   identificação, valida, registra auditoria e devolve ao /admin para vínculo.
// - error=cancelled: trata cancelamento/erro no provedor (volta com aviso).
// - REAL (CHECKPOINT 7 preenchido): aqui entra troca code->token + vínculo CPF.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(
      new URL(`/admin?govbr=cancelled`, url.origin)
    );
  }
  if (!url.searchParams.get("homolog")) {
    return NextResponse.json(
      { ok: false, error: "Gov.br real não configurado (CHECKPOINT 7)" },
      { status: 501 }
    );
  }
  const cpf = (url.searchParams.get("cpf") ?? "").replace(/\D/g, "");
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!/^\d{11}$/.test(cpf) || name.length < 3) {
    return NextResponse.redirect(new URL(`/admin?govbr=invalid`, url.origin));
  }
  await db.insert(auditLog).values({
    actorType: "EXTERNAL",
    actorId: cpf,
    action: "GOVBR_SIMULATED_LOGIN",
    entityType: "external_auth",
    entityId: cpf,
    metadata: { name, simulated: true },
  });
  const back = new URL("/admin", url.origin);
  back.searchParams.set("govbr", "ok");
  back.searchParams.set("cpf", cpf);
  back.searchParams.set("name", name);
  return NextResponse.redirect(back);
}
