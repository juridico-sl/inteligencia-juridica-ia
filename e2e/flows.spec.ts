import path from "node:path";
import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_AUTH,"requer Supabase local isolado");
test("fluxo jurídico autenticado completo",async({page})=>{
  await page.goto("/login");await page.getByLabel("E-mail").fill("e2e.advogado@example.test");await page.getByLabel("Senha").fill("E2e-Juridico-2026!");await page.getByRole("button",{name:"Entrar"}).click();await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/processos");await page.getByText("Cadastrar processo").click();await page.getByLabel("Número CNJ").fill("0000000-89.2026.8.26.0001");await page.getByLabel("Valor da causa").fill("15000");await page.getByLabel("Exposição estimada").fill("5000");await page.getByLabel("Provisão").fill("2500");await page.getByRole("button",{name:"Cadastrar e sincronizar"}).click();await expect(page).toHaveURL(/\/processos\/[0-9a-f-]+$/);await expect(page.getByRole("heading",{name:"0000000-89.2026.8.26.0001"})).toBeVisible();
  await page.getByRole("button",{name:"Atualizar DataJud"}).click();await expect(page.getByRole("status")).toContainText(/Sincronização/);
  await page.goto("/prazos");await page.getByPlaceholder("Título").fill("Prazo E2E");await page.locator('input[name="due_at"]').fill("2027-01-15T12:00");await page.getByRole("button",{name:"Criar prazo confirmado"}).click();await expect(page.getByText("Prazo E2E")).toBeVisible();
  await page.goto("/documentos");await page.locator('input[type="file"]').first().setInputFiles(path.join(process.cwd(),"e2e/fixtures/e2e-document.txt"));await page.locator('select[name="type"]').selectOption("parecer");await page.getByRole("button",{name:"Enviar documento"}).click();await expect(page.getByRole("status")).toContainText("Upload concluído");
  await page.goto("/busca");await page.getByLabel("Pesquisa global").fill("e2e-document");await expect(page.getByText("e2e-document.txt")).toBeVisible();
  await page.goto("/chat");await page.getByPlaceholder("O que precisa da minha atenção hoje?").fill("Qual é o total de processos no dashboard?");await page.getByRole("button",{name:"Enviar"}).click();await expect(page.getByText(/Os dados foram consultados pela ferramenta autorizada/)).toBeVisible();await expect(page.getByText(/Fontes \(1\)/)).toBeVisible();
  await page.goto("/relatorios");await expect(page.getByRole("heading",{name:"Relatórios"})).toBeVisible();const download=page.waitForEvent("download");await page.getByRole("link",{name:"Exportar CSV"}).click();expect((await download).suggestedFilename()).toMatch(/\.csv$/);
});
