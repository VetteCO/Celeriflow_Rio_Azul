// Validação de CPF (dígitos verificadores). Usado na simulação gov.br e
// reutilizável no cadastro do cidadão.
export function validCpf(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += parseInt(d[i]!, 10) * (t + 1 - i);
    const mod = (sum * 10) % 11;
    if (mod % 10 !== parseInt(d[t]!, 10)) return false;
  }
  return true;
}
