// Proxy ViaCEP + fallback BrasilAPI / CEP geral municipal (POC-07).
import { NextResponse } from "next/server";

const GENERAL_CEPS: Record<string, { street: string; district: string; city: string; state: string; general: boolean }> = {
  "84560000": { street: "", district: "Centro", city: "Rio Azul", state: "PR", general: true },
};

async function fetchJsonWithTimeout<T>(url: string, ms = 6000): Promise<{ ok: boolean; status: number; data: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cep = (searchParams.get("cep") ?? "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep))
    return NextResponse.json({ error: "cep inválido (8 dígitos)" }, { status: 400 });

  const viaCep = await fetchJsonWithTimeout<{ erro?: boolean } & Record<string, string>>(
    `https://viacep.com.br/ws/${cep}/json/`
  );
  if (viaCep.ok && viaCep.data && !viaCep.data.erro && (viaCep.data.localidade || viaCep.data.uf)) {
    return NextResponse.json({
      street: viaCep.data.logradouro ?? "",
      district: viaCep.data.bairro ?? "",
      city: viaCep.data.localidade ?? "",
      state: viaCep.data.uf ?? "",
      general: !viaCep.data.logradouro,
    });
  }

  const brasilApi = await fetchJsonWithTimeout<{ street?: string; neighborhood?: string; city?: string; state?: string }>(
    `https://brasilapi.com.br/api/cep/v1/${cep}`
  );
  if (brasilApi.ok && brasilApi.data?.city && brasilApi.data?.state) {
    return NextResponse.json({
      street: brasilApi.data.street ?? "",
      district: brasilApi.data.neighborhood ?? "",
      city: brasilApi.data.city,
      state: brasilApi.data.state,
      general: !brasilApi.data.street,
    });
  }

  const generalFallback = GENERAL_CEPS[cep];
  if (generalFallback) {
    return NextResponse.json(generalFallback);
  }

  if ((viaCep.ok && viaCep.data?.erro) || brasilApi.status === 404) {
    return NextResponse.json({ error: "cep não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ error: "serviço de cep indisponível" }, { status: 502 });
}
