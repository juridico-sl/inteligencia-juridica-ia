import { describe, expect, it } from "vitest";
import { formatCnj, isValidCnj, normalizeCnj } from "./legal";

describe("número CNJ",()=>{
  it("normaliza e formata 20 dígitos",()=>{const value=normalizeCnj("0000000-89.2026.8.26.0001");expect(value).toBe("00000008920268260001");expect(isValidCnj(value)).toBe(true);expect(formatCnj(value)).toBe("0000000-89.2026.8.26.0001")});
  it("rejeita tamanho incorreto",()=>expect(isValidCnj("123")).toBe(false));
});
