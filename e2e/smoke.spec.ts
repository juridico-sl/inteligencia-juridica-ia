import { expect, test } from "@playwright/test";

test("login e cabeçalhos de segurança",async({page})=>{const response=await page.goto("/login");await expect(page.getByRole("heading",{name:/Central Jurídica IA/i})).toBeVisible();expect(response?.headers()["content-security-policy"]).toContain("nonce-");expect(response?.headers()["x-frame-options"]).toBe("DENY")});
test("API mutável rejeita origem ausente",async({request})=>{const response=await request.post("/api/v1/processes",{data:{process_number:"00000000000000000000"}});expect(response.status()).toBe(403)});
