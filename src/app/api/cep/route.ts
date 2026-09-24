// Proxy ViaCEP (POC-07): valida formato no backend e busca endereço.
// Evita CORS e normaliza resposta para o formulário do cidadão.
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cep = (searchParams.get("cep") ?? "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep))
    return NextResponse.json({ error: "cep inválido (8 dígitos)" }, { status: 400 });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: ctrl.signal,
    });
    if (!r.ok) return NextResponse.json({ error: "viacep indisponível" }, { status: 502 });
    const d = (await r.json()) as { erro?: boolean } & Record<string, string>;
    if (d.erro) return NextResponse.json({ error: "cep não encontrado" }, { status: 404 });
    return NextResponse.json({
      street: d.logradouro ?? "",
      district: d.bairro ?? "",
      city: d.localidade ?? "",
      state: d.uf ?? "",
    });
  } catch {
    return NextResponse.json({ error: "viacep indisponível" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
