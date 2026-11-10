/** Domain normalization for masked forms. Monetary arithmetic uses integer cents. */
export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function parseBrlCents(value: string): number | null {
  const normalized = value.replace(/R\$/g, "").replace(/\s/g, "");
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized)) return null;
  const negative = normalized.startsWith("-");
  const [integer, decimals = ""] = normalized.replace(/^-/, "").replace(/\./g, "").split(",");
  const cents = Number(integer) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? (negative ? -cents : cents) : null;
}

export function formatBrlCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Valor monetário inválido.");
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}
