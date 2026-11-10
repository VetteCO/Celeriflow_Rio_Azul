export function validCpfCnpj(input: string): boolean {
  const d = input.replace(/\D/g, "");
  if (!/^\d{11}$|^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const digits = d.split("").map(Number);
  if (d.length === 11) {
    for (let count = 9; count <= 10; count++) { const sum = digits.slice(0, count).reduce((s, v, i) => s + v * (count + 1 - i), 0); const check = (sum * 10) % 11 % 10; if (digits[count] !== check) return false; }
  } else {
    for (let count = 12; count <= 13; count++) { const weights = count === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const mod = digits.slice(0, count).reduce((s, v, i) => s + v * weights[i], 0) % 11; if (digits[count] !== (mod < 2 ? 0 : 11 - mod)) return false; }
  }
  return true;
}
