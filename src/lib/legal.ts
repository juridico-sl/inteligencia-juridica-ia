import { createHash } from "node:crypto";

export function normalizeCnj(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCnj(value: string) {
  const cnj = normalizeCnj(value);
  if (!/^\d{20}$/.test(cnj)) return false;
  const check = Number(cnj.slice(7, 9));
  const base = `${cnj.slice(0, 7)}${cnj.slice(9)}00`;
  let remainder = 0;
  for (const digit of base) remainder = (remainder * 10 + Number(digit)) % 97;
  return check === 98 - remainder;
}

export function formatCnj(value: string) {
  const cnj = normalizeCnj(value);
  return cnj.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, "$1-$2.$3.$4.$5.$6");
}

export function movementHash(input: { date: string; code?: string | null; description: string }) {
  const normalized = `${new Date(input.date).toISOString()}|${input.code ?? ""}|${input.description.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")}`;
  return createHash("sha256").update(normalized).digest("hex");
}
