// POC-03 — Mascaramento LGPD central. Usar SEMPRE em DTO público.
// Nunca serializar User/Citizen interno direto na área pública.

export function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "").padStart(11, "0");
  // ***.123.456-**
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function maskCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "").padStart(14, "0");
  // **.***.123/0001-**
  return `**.***.${d.slice(8, 11)}/${d.slice(11, 15)}-**`;
}

export function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length <= 11 ? maskCpf(v) : maskCnpj(v);
}
