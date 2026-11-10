export type MaskKind = "cpf" | "cnpj" | "cpfCnpj" | "cep" | "phone" | "currency";

export function formatInput(value: string, kind: MaskKind): string {
  const digits = value.replace(/\D/g, "");
  if (kind === "currency") {
    if (!digits) return "";
    return ((value.includes("-") ? -1 : 1) * Number(digits.slice(0, 15)) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (kind === "cpfCnpj") return formatInput(value, digits.length <= 11 ? "cpf" : "cnpj");
  const pattern = kind === "cpf" ? "###.###.###-##" : kind === "cnpj" ? "##.###.###/####-##" : kind === "cep" ? "#####-###" : digits.length > 10 ? "(##) #####-####" : "(##) ####-####";
  let result = "", index = 0;
  for (const char of pattern) {
    if (index >= digits.length) break;
    result += char === "#" ? digits[index++] : char;
  }
  return result;
}

export const maskPlaceholder: Record<MaskKind, string> = {
  cpf: "000.000.000-00", cnpj: "00.000.000/0000-00", cpfCnpj: "000.000.000-00 / 00.000.000/0000-00",
  cep: "00000-000", phone: "(00) 00000-0000", currency: "R$ 0,00",
};
