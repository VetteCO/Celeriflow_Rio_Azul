import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { chromium, type Page } from "playwright-core";
import { firebaseAdminAuth } from "../src/lib/firebase-admin";
import { businessDate, type Field } from "../src/lib/modules/domain";

type Row = Record<string, any>;
type Harness = { base: string; dir: string; users: Row[]; sectors: string[]; api: (label: string, path: string, bearer?: string, method?: string, body?: unknown, statuses?: number[]) => Promise<Row>; check: (label: string, value: unknown) => void; scenario: (label: string, fn: () => Promise<void>) => Promise<void>; own: (table: string, value: string, key?: string) => string; token: (uid: string) => Promise<string> };
export async function workflowFieldScenarios(h: Harness) {
  const { api, check } = h, [writer, external, , reader] = h.users, [sector] = h.sectors;
  let activePage: Page | undefined;
  const scenario: Harness["scenario"] = (label, fn) => h.scenario(label, async () => { try { await fn(); } catch (error) { writeFileSync(join(h.dir, `${label}.private.txt`), String((error as Error).stack)); if(activePage) writeFileSync(join(h.dir, `${label}.html`), await activePage.content()); throw error; } });
  const sql = neon(process.env.DATABASE_URL!);
  // Exclusively owned accounts; this flag is test setup, not proof of mailbox delivery.
  await firebaseAdminAuth().updateUser(external.firebaseUid, { emailVerified: true }); external.token = await h.token(external.firebaseUid);
  let flow: Row, internalRecord: Row | undefined, externalRecord: Row, anonymous: Row;
  const secret = randomBytes(32).toString("hex");
  const fields: Partial<Field>[] = [
    { key: "apresentacao", label: "Conservação de espaços públicos", type: "heading", presentation: { bold: true, italic: false, underline: false, align: "center", size: 20 } },
    { key: "orientacao", label: "Informe o local e descreva as condições de acesso.", type: "paragraph" },
    { key: "data", label: "Data do registro", type: "date", defaultToday: true, locked: true },
    { key: "origem", label: "Origem do atendimento", type: "text", initialValue: "Atendimento municipal", locked: true, width: "50" },
    { key: "nota", label: "Nota da equipe", type: "text", visibility: "INTERNO", editAfterProtocol: "INTERNO", width: "50" },
    { key: "modo", label: "Necessita detalhamento", type: "radio", options: ["Sim", "Não"], required: true, editAfterProtocol: "AMBOS" },
    { key: "detalhe", label: "Detalhe da solicitação", type: "textarea", editAfterProtocol: "AMBOS", rules: [{ action: "EXIBIR", condition: { field: "modo", equals: "Sim" } }, { action: "OBRIGAR", condition: { field: "modo", equals: "Sim" } }, { action: "OCULTAR", condition: { field: "modo", equals: "Não" } }], helpImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOioAAAAASUVORK5CYII=" },
    { key: "cep", label: "CEP do local", type: "cep", addressMapping: { street: "logradouro", district: "bairro", city: "cidade", state: "uf" }, width: "25" },
    ...[["logradouro", "Logradouro"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"]].map(([key, label]) => ({ key, label, type: "text" as const, width: "50" as const })),
  ];
  const read = async (id: string) => (await api("fields-staff-read", `/api/modules/records/${id}`, writer.token)).record;
  const command = async (id: string, action: string, payload: Row = {}, statuses = [200]) => api(`fields-${action}`, `/api/modules/records/${id}`, writer.token, "PATCH", { revision: (await read(id)).revision, action, payload, note: "Conferência dos dados de atendimento e correção fundamentada." }, statuses);
  await scenario("fields-configuration-and-server-policy", async () => {
    flow = (await api("fields-configure", "/api/modules/fluxos", writer.token, "POST", { title: "Conservação urbana e acesso aos equipamentos", body: "Atendimento de Aurora das Veredas.", values: { externalEnabled: "Sim", anonymousEnabled: "Sim" }, workflow: { family: "ouvidoria", fields, steps: [{ name: "Análise e decisão", departments: [sector], hours: 24, decision: true }], requiredFiles: [], identityDepartmentId: sector } }, [201])).record;
    await command(flow.id, "ATIVAR");
    const options = await api("fields-external-options", "/api/modules/external", external.token);
    check("fields-internal-definition-not-exposed", !JSON.stringify(options.options.find((o: Row) => o.id === flow.id)).includes("Nota da equipe"));
    await api("fields-reject-locked-injection", "/api/modules/external", external.token, "POST", { workflowId: flow.id, title: "Conservação do passeio da biblioteca", body: "Verificar o acesso e a continuidade da faixa livre.", name: "Beatriz Moreira", values: { modalidade: "Identificada", finalidade: "Solicitação", modo: "Não", origem: "Outra" }, idempotencyKey: randomUUID() }, [400]);
    await api("fields-reject-internal-injection", "/api/modules/external", external.token, "POST", { workflowId: flow.id, title: "Conservação do passeio da biblioteca", body: "Verificar o acesso e a continuidade da faixa livre.", name: "Beatriz Moreira", values: { modalidade: "Identificada", finalidade: "Solicitação", modo: "Não", nota: "Injetada" }, idempotencyKey: randomUUID() }, [400]);
  });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  const errors: string[] = [];
  const login = async (page: Page, user: Row) => {
    activePage = page;
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(h.base + "/admin"); await page.getByLabel("E-mail", { exact: true }).fill(user.email); await page.getByLabel("Senha", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.getByRole("heading", { name: "Servidores e permissões", exact: true }).waitFor({ timeout: 60000 });
  };
  try {
    await scenario("fields-browser-internal-creation-and-reopen", async () => {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); await login(page, writer);
      await page.route("**/api/modules/ouvidoria", async route => { if (route.request().method() !== "POST") return route.continue(); const data = await api("fields-browser-create-internal", "/api/modules/ouvidoria", writer.token, "POST", route.request().postDataJSON(), [201]); internalRecord = data.record; await route.fulfill({ status: 201, json: data }); });
      await page.goto(h.base + "/gestao/ouvidoria/novo"); await page.getByLabel("Assunto e fluxo", { exact: false }).selectOption(flow.id);
      await page.getByLabel("Título / assunto", { exact: false }).fill("Conservação do acesso à biblioteca");
      await page.getByLabel("Identificação", { exact: false }).filter({ has: page.locator("option") }).selectOption("Identificada");
      await page.getByLabel("Finalidade", { exact: false }).selectOption("Solicitação");
      const identity = page.getByRole("group", { name: "Identificação do manifestante", exact: true }); await identity.getByLabel("Nome", { exact: true }).fill("Beatriz Moreira"); await identity.getByLabel("E-mail", { exact: true }).fill("beatriz@aurora.mg.gov.br");
      await page.getByRole("radio", { name: "Sim", exact: true }).check(); await page.getByLabel("Detalhe da solicitação", { exact: false }).fill("Conferir o nivelamento e a largura do passeio."); await page.getByLabel("Nota da equipe", { exact: false }).fill("Informação interna de instrução");
      check("fields-date-and-lock-visible-internal", await page.getByLabel("Data do registro", { exact: false }).inputValue() === businessDate() && await page.getByLabel("Origem do atendimento", { exact: false }).isDisabled());
      await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click(); await page.getByRole("heading", { name: "Conservação do acesso à biblioteca", exact: true }).waitFor();
      await page.reload(); await page.getByText("Informação interna de instrução", { exact: true }).waitFor(); check("fields-internal-persisted-after-browser-reopen", (await read(internalRecord!.id)).data.values.data === businessDate());
      await command(internalRecord!.id, "PROTOCOLAR");
      await command(internalRecord!.id, "EDITAR_CAMPOS", { values: { nota: "Revisão interna documentada" } });
      await command(internalRecord!.id, "EDITAR_CAMPOS", { values: { origem: "Alterada" } }, [400]);
      const r = await read(internalRecord!.id); await api("fields-n3-cannot-edit", `/api/modules/records/${r.id}`, reader.token, "PATCH", { revision: r.revision, action: "EDITAR_CAMPOS", payload: { values: { nota: "Sem autorização" } }, note: "Sem autorização." }, [403]);
      await page.goto(h.base + `/gestao/registros/${r.id}`); await page.getByRole("button", { name: "Fluxo e respostas", exact: true }).click(); await page.getByLabel("Nota da equipe", { exact: false }).fill("Conferência registrada pela interface"); await page.getByLabel("Justificativa da alteração", { exact: true }).fill("Complementação da instrução do atendimento."); await page.getByRole("button", { name: "Salvar campos autorizados", exact: true }).click(); await page.getByText("Operação registrada.", { exact: true }).waitFor();
      check("fields-internal-post-protocol-browser-write", (await read(r.id)).data.values.nota === "Conferência registrada pela interface"); await page.close();
    });
    await scenario("fields-browser-external-creation-and-reopen", async () => {
      const page = await browser.newPage(); await login(page, external);
      await page.route("**/api/modules/external", async route => { if (route.request().method() !== "POST") return route.continue(); const data = await api("fields-browser-create-external", "/api/modules/external", external.token, "POST", route.request().postDataJSON(), [201]); externalRecord = data.record; await route.fulfill({ status: 201, json: data }); });
      await page.goto(h.base + "/gestao/central/novo"); await page.getByLabel("Serviço", { exact: false }).selectOption(flow.id);
      await page.getByLabel("Nome do interessado", { exact: true }).fill("Beatriz Moreira"); await page.getByLabel("Assunto", { exact: true }).fill("Adequação do acesso ao centro cultural"); await page.getByLabel("Identificação", { exact: false }).selectOption("Identificada"); await page.getByLabel("Finalidade", { exact: false }).selectOption("Solicitação"); await page.getByRole("radio", { name: "Sim", exact: true }).check(); await page.getByLabel("Detalhe da solicitação", { exact: false }).fill("Verificar a continuidade da faixa acessível."); await page.getByLabel("Solicitação", { exact: true }).fill("Solicito a conferência do acesso principal do centro cultural.");
      check("fields-hidden-internal-in-external-browser", await page.getByLabel("Nota da equipe", { exact: false }).count() === 0);
      await page.getByLabel("CEP do local", { exact: false }).fill("01001000");
      await page.getByText("Endereço consultado. Confira os dados antes de enviar.", { exact: true }).waitFor();
      check("fields-cep-real-address-populates-linked-fields", (await page.getByLabel("Cidade", { exact: true }).inputValue()) === "São Paulo" && (await page.getByLabel("Logradouro", { exact: true }).inputValue()).length > 0);
      await page.getByRole("button", { name: "Continuar para anexos e protocolização", exact: true }).click(); await page.getByRole("heading", { name: "Adequação do acesso ao centro cultural", exact: true }).waitFor(); await page.reload(); await page.getByRole("heading", { name: "Adequação do acesso ao centro cultural", exact: true }).waitFor();
      await page.getByRole("button", { name: "Protocolar solicitação", exact: true }).click(); await page.getByRole("button", { name: "Enviar resposta", exact: true }).waitFor();
      const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvar campos autorizados", exact: true }) }); await form.getByLabel("Detalhe da solicitação", { exact: false }).fill("Complementação após protocolização pela conta titular.");
      await Promise.all([page.waitForResponse(response => response.url().endsWith(`/api/modules/external/${externalRecord.id}`) && response.request().method() === "GET"), form.getByRole("button", { name: "Salvar campos autorizados", exact: true }).click()]);
      const raw = await read(externalRecord.id); check("fields-external-post-protocol-persisted", raw.data.values.detalhe === "Complementação após protocolização pela conta titular.");
      const response = await api("fields-external-safe-dto", `/api/modules/external/${externalRecord.id}`, external.token); check("fields-internal-never-in-external-dto", !JSON.stringify(response).includes("nota") && response.record.values.data === businessDate()); await page.close();
    });
    await scenario("fields-browser-anonymous-and-idempotent-updates", async () => {
      const page = await browser.newPage(); activePage = page; page.on("pageerror", error => errors.push(error.message));
      await page.route("**/api/modules/anonymous", async route => {
        const body = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
        if (body?.action !== "CREATE") return route.continue();
        const data = await api("fields-browser-create-anonymous", "/api/modules/anonymous", undefined, "POST", { ...body, key: secret });
        const [row] = await sql("SELECT id FROM module_record WHERE code=$1", [data.code]); h.own("module_record", row.id as string); anonymous = row;
        // Preserve the browser-generated secret while routing it consistently to this owned record.
        await route.fulfill({ status: 200, json: data });
      });
      await page.route("**/api/modules/anonymous", async (route, next) => {
        if (route.request().method() !== "POST") return route.fallback(); const body = route.request().postDataJSON(); if (body.action === "CREATE") return route.fallback();
        const data = await api(`fields-anonymous-${body.action}`, "/api/modules/anonymous", undefined, "POST", { ...body, key: secret }); await route.fulfill({ status: 200, json: data });
      });
      await page.goto(h.base + "/gestao/anonimo"); await page.getByLabel("Assunto configurado", { exact: false }).selectOption(flow.id); await page.getByLabel("Título", { exact: true }).fill("Iluminação no acesso à biblioteca"); await page.getByLabel("Relato", { exact: true }).fill("Solicita-se verificar os pontos de iluminação no acesso à biblioteca."); await page.getByRole("radio", { name: "Sim", exact: true }).check(); await page.getByLabel("Detalhe da solicitação", { exact: false }).fill("Conferir a iluminação no percurso de acesso.");
      check("fields-anonymous-presentations-and-help-image", await page.getByRole("heading", { name: "Conservação de espaços públicos", exact: true }).count() === 1 && await page.getByRole("img", { name: "Orientação: Detalhe da solicitação", exact: true }).count() === 1);
      await page.getByRole("button", { name: "Salvar manifestação", exact: true }).click(); await page.getByRole("button", { name: "Protocolar manifestação", exact: true }).waitFor(); await page.getByRole("button", { name: "Protocolar manifestação", exact: true }).click(); await page.getByRole("button", { name: "Complementar relato", exact: true }).waitFor();
      const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvar campos autorizados", exact: true }) }); await form.getByLabel("Detalhe da solicitação", { exact: false }).fill("Complementação anônima após o protocolo."); await form.getByRole("button", { name: "Salvar campos autorizados", exact: true }).click(); await page.getByText("Campos atualizados.", { exact: true }).waitFor();
      const r = await read(anonymous.id); check("fields-anonymous-post-protocol-persisted", r.data.values.detalhe === "Complementação anônima após o protocolo." && r.data.values.data === businessDate());
      const operationId = randomUUID(), body = { action: "FIELDS", key: secret, operationId, revision: r.revision, values: { detalhe: "Atualização com identificador estável." } };
      await api("fields-anonymous-update-first", "/api/modules/anonymous", undefined, "POST", body); await api("fields-anonymous-update-replay", "/api/modules/anonymous", undefined, "POST", body); const after = await read(anonymous.id); check("fields-anonymous-replay-single-revision", after.revision === r.revision + 1);
      await api("fields-anonymous-conflicting-replay-denied", "/api/modules/anonymous", undefined, "POST", { ...body, values: { detalhe: "Outro conteúdo." } }, [409]);
      await api("fields-anonymous-locked-write-denied", "/api/modules/anonymous", undefined, "POST", { ...body, revision: after.revision, operationId: randomUUID(), values: { origem: "Alterada" } }, [400]);
      await page.screenshot({ path: join(h.dir, "anonymous-fields.png"), fullPage: true }); await page.close();
    });
    check("fields-browser-no-runtime-errors", errors.length === 0);
  } finally { await browser.close(); }
  if (internalRecord) {
    const versions = await sql("SELECT count(*)::int AS count FROM module_version WHERE record_id=$1 AND action='EDITAR_CAMPOS'", [internalRecord.id]); check("fields-immutable-history-preserves-edits", Number(versions[0].count) >= 2);
  }
  writeFileSync(join(h.dir, "field-scope.json"), JSON.stringify({ at: new Date().toISOString(), channels: ["INTERNO", "EXTERNO_IDENTIFICADO", "ANONIMO"], mailboxDeliveryProven: false, identityVerification: "Owned automated accounts only; not civil identity verification." }, null, 2));
}
