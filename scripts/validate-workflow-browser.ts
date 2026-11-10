import assert from "node:assert/strict";
import { chromium } from "playwright-core";

// Local UI contract only: API interception prevents writes to municipal data.
async function main() {
const base = process.env.VALIDATION_BASE_URL ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("Use a local application for this isolated browser check.");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const results: string[] = [];
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let payload: Record<string, unknown> | undefined;
  const fields = [
    { key: "descricao", label: "Descrição complementar", type: "textarea", minLength: 3, maxLength: 50, placeholder: "Descreva a situação", required: true },
    { key: "local", label: "Local público", type: "radio", options: ["Sim", "Não"], required: true },
    { key: "servicos", label: "Serviços envolvidos", type: "checkbox", options: ["Iluminação", "Limpeza"], required: true },
    { key: "pontos", label: "Quantidade de pontos", type: "integer", required: true },
    { key: "endereco", label: "Endereço do local", type: "text", required: true, condition: { field: "local", equals: "Sim" } },
    { key: "luminarias", label: "Identificação das luminárias", type: "text", required: true, condition: { field: "servicos", equals: "Iluminação", operator: "contains" } },
  ].map(field => ({ options: [], help: "Orientação do serviço", ...field }));
  await page.route("**/api/modules/anonymous", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: [{ id: "fluxo-local", title: "Conservação urbana", fields, requiredFiles: [] }] });
    payload = route.request().postDataJSON();
    return route.fulfill({ status: 409, json: { error: "Validação isolada: nenhuma gravação realizada." } });
  });
  await page.goto(`${base}/gestao/anonimo`);
  await page.getByLabel("Assunto configurado").selectOption("fluxo-local");
  assert.equal(await page.getByLabel("Endereço do local", { exact: false }).count(), 0);
  assert.equal(await page.getByLabel("Identificação das luminárias", { exact: false }).count(), 0);
  results.push("conditional fields initially hidden");
  await page.getByRole("radio", { name: "Sim", exact: true }).check();
  await page.getByLabel("Endereço do local", { exact: false }).fill("Praça das Acácias");
  await page.getByRole("checkbox", { name: "Iluminação", exact: true }).check();
  await page.getByLabel("Identificação das luminárias", { exact: false }).fill("Poste 12");
  results.push("radio and checkbox conditions reveal required controls");
  await page.getByLabel("Título", { exact: true }).fill("Conservação da praça");
  await page.getByLabel("Relato", { exact: true }).fill("Solicito conservação dos equipamentos da praça.");
  await page.getByPlaceholder("Descreva a situação").fill("Equipamentos danificados");
  await page.getByLabel("Quantidade de pontos", { exact: false }).fill("1.5");
  assert.equal(await page.locator("form").evaluate((form: HTMLFormElement) => form.checkValidity()), false);
  await page.getByLabel("Quantidade de pontos", { exact: false }).fill("2");
  assert.equal(await page.locator("form").evaluate((form: HTMLFormElement) => form.checkValidity()), true);
  results.push("integer browser validity enforced");
  await page.getByRole("checkbox", { name: "Iluminação", exact: true }).uncheck();
  assert.equal(await page.locator("form").evaluate((form: HTMLFormElement) => form.checkValidity()), false);
  await page.getByRole("checkbox", { name: "Limpeza", exact: true }).check();
  assert.equal(await page.locator("form").evaluate((form: HTMLFormElement) => form.checkValidity()), true);
  results.push("any checkbox option satisfies group requirement");
  await page.getByRole("button", { name: "Salvar manifestação", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "nenhuma gravação" }).waitFor();
  assert.equal((payload?.values as Record<string, string>).servicos, '["Limpeza"]');
  assert.equal((payload?.values as Record<string, string>).pontos, "2");
  results.push("submission preserves serialized selections and numeric values");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ scope: "isolated local browser; no database writes", passed: results.length, results }, null, 2));
} finally {
  await browser.close();
}
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
