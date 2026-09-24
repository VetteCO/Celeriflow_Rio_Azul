// POC-02 — Adapter Gov.br (Login Único) PREDISPOSTO.
// Sem GOVBR_CLIENT_ID, as rotas usam MOCK para não travar a POC.
// Quando preencher CHECKPOINT 7, implementar fluxo OIDC real aqui.

export const govbrConfigured = Boolean(process.env.GOVBR_CLIENT_ID);

export function govbrLoginUrl(state: string): string {
  if (!govbrConfigured) return `/api/auth/govbr/callback?mock=1&state=${state}`;
  const base = process.env.GOVBR_DISCOVERY_URL ?? "";
  const redirect = encodeURIComponent(process.env.GOVBR_REDIRECT_URI!);
  return `${base}/authorize?response_type=code&client_id=${process.env.GOVBR_CLIENT_ID}&redirect_uri=${redirect}&scope=openid+profile&state=${state}`;
}
