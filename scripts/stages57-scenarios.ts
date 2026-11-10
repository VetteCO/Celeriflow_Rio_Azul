import { randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";
import { PDFDocument } from "pdf-lib";
import { type Family } from "../src/lib/modules/domain";

type Row = Record<string, any>;
type Harness = {
  base: string; dir: string; users: Row[]; sectors: string[];
  api: (label: string, path: string, bearer?: string, method?: string, body?: unknown, statuses?: number[]) => Promise<Row>;
  check: (assertion: string, condition: unknown) => void;
  scenario: (label: string, run: () => Promise<void>) => Promise<void>;
  own: (table: string, id: string, key?: string) => string;
  ownModuleFile: (recordId: string, fileId: string) => Promise<Row>;
  values: (family: Family) => Record<string, string>;
};
export async function stages57(h: Harness) {
  const { api, check, scenario, own, ownModuleFile, values } = h;
  const [ua, ub, uc, n3] = h.users, [a, b] = h.sectors;
  const change = async (r: Row, action: string, user = ua, payload = {}, expected = 200) => (await api(`57-${r.family}-${action}`, `/api/modules/records/${r.id}`, user.token, "PATCH", { revision: r.revision, action, payload, note: "Análise administrativa fundamentada e registrada." }, [expected])).record;
  const pdf = await PDFDocument.create(); pdf.addPage().drawText("Registro documental de atendimento municipal."); const original = Buffer.from(await pdf.save());
  const upload = async (r: Row, user = ua, category = "Comprovante") => {
    const form = new FormData(); form.set("file", new Blob([original], { type: "application/pdf" }), "comprovante.pdf"); form.set("category", category); form.set("externalVisible", "true");
    const file = await api("57-required-original-upload", `/api/modules/records/${r.id}/files`, user.token, "POST", form, [201]); await ownModuleFile(r.id, file.id);
    return file.id as string;
  };
  let browserFlow: Row | undefined, browserProcess: Row | undefined, service: Row | undefined, delegate: Row | undefined;
  await scenario("57-pending-signer-has-only-own-refusal", async () => {
    let record = (await api("57-signature-draft", "/api/modules/ged", ua.token, "POST", { title: "Expediente com solicitação de assinatura", body: "Documento administrativo para ciência do responsável." }, [201])).record;
    record = await change(record, "PROTOCOLAR");
    record = await change(record, "SOLICITAR_ASSINATURA", ua, { signers: [{ userId: uc.id, order: 1 }] });
    const signer = await api("57-outside-pending-signer-capabilities", `/api/modules/records/${record.id}`, uc.token);
    check("57-pending-signer-cannot-edit-document", signer.permissions.edit === false && JSON.stringify(signer.permissions.actions) === JSON.stringify(["RECUSAR_ASSINATURA"]));
    record = await change(record, "RECUSAR_ASSINATURA", uc);
    check("57-own-refusal-recorded-without-cryptographic-signature", record.data.signatures[0].status === "RECUSADA" && !!record.data.signatures[0].reason);
    await api("57-refused-signer-loses-temporary-read", `/api/modules/records/${record.id}`, uc.token, "GET", undefined, [404]);
  });
  await scenario("57-expanded-service-families", async () => {
    for (const family of ["chamados", "esic", "pessoal", "pad", "judicial", "seletivo"] as Family[]) {
      const sector = family === "pessoal" ? b : a;
      let flow = (await api(`57-configure-${family}`, "/api/modules/fluxos", ua.token, "POST", { title: `Atendimento municipal — ${family}`, workflow: { family, fields: [{ key: "opcao", label: "Exige detalhamento", type: "radio", options: ["Sim", "Não"], required: true }, { key: "detalhe", label: "Detalhamento", type: "textarea", required: true, condition: { field: "opcao", equals: "Sim" } }], steps: [{ name: "Análise e decisão", departments: [sector], hours: 16, decision: true }], requiredFiles: ["Comprovante"], businessDays: true, ...(family === "pessoal" ? { rhDepartmentId: b } : {}) } }, [201])).record;
      flow = await change(flow, "ATIVAR");
      let record = (await api(`57-create-${family}`, `/api/modules/${family}`, ua.token, "POST", { title: `Solicitação municipal — ${family}`, body: "Solicitação sujeita a análise, prazo e decisão fundamentada.", values: { ...values(family), opcao: "Não" }, workflowId: flow.id, idempotencyKey: randomUUID() }, [201])).record;
      await change(record, "PROTOCOLAR", ua, {}, 400);
      await upload(record);
      record = (await api("57-refresh-upload-revision", `/api/modules/records/${record.id}`, ua.token)).record;
      record = await change(record, "PROTOCOLAR");
      check(`57-${family}-sla-and-conditional-field`, !!record.data.dueAt && record.data.workflow.fields[1].required && record.status === "EM_ANDAMENTO");
      if (family === "pessoal") {
        check("57-rh-only-participants", record.departmentId === b && JSON.stringify(record.participants) === JSON.stringify([b]));
        await api("57-rh-unrelated-admin-denied", `/api/modules/records/${record.id}`, uc.token, "GET", undefined, [404]);
        await change(record, "CONCLUIR_SETOR", ua, { departmentId: a }, 403);
      }
      await change(record, "DEFERIR", family === "pessoal" ? ub : ua, {}, 400);
      const reader = await api("57-n3-detail", `/api/modules/records/${record.id}`, n3.token, "GET", undefined, family === "pessoal" ? [404] : [200]);
      if (family !== "pessoal") check("57-n3-no-edit-or-state-actions", reader.permissions.edit === false && reader.permissions.actions.length === 0);
      const responsible = family === "pessoal" ? ub : ua;
      record = await change(record, "CONCLUIR_SETOR", responsible, { departmentId: sector });
      record = await change(record, family === "esic" ? "INDEFERIR" : "DEFERIR", responsible);
      check(`57-${family}-decision`, ["DEFERIDO", "INDEFERIDO"].includes(record.status));
      const exported = await fetch(`${h.base}/api/modules/records/${record.id}/export`, { headers: { authorization: `Bearer ${responsible.token}` } });
      check(`57-${family}-pdf-export`, exported.ok && (await PDFDocument.load(await exported.arrayBuffer())).getPageCount() >= 1);
      record = await change(record, "ARQUIVAR", responsible);
      check(`57-${family}-archive`, record.status === "ARQUIVADO");
      const found = await api(`57-${family}-searchable`, `/api/modules/${family}`, ua.token);
      check(`57-${family}-list-by-code`, found.records.some((r: Row) => r.id === record.id && r.code === record.code));
    }
  });
  await scenario("57-delegation-usage-cancellation-report", async () => {
    delegate = (await api("57-create-delegation", "/api/modules/delegacoes", ua.token, "POST", { title: "Autorização de emissão administrativa", values: { digitador: ub.id, limite: "1", validade: "2030-01-15" } }, [201])).record;
    delegate = await change(delegate!, "ATIVAR");
    const drafts: Row[] = [];
    for (let i = 0; i < 2; i++) drafts.push((await api("57-create-delegated-draft", "/api/modules/ged", ub.token, "POST", { title: `Expediente municipal autorizado ${i + 1}`, body: "Conteúdo administrativo setorial.", idempotencyKey: randomUUID() }, [201])).record);
    const [one, two] = await Promise.all(drafts.map((r, i) => api(`57-concurrent-delegation-${i}`, `/api/modules/records/${r.id}/delegation`, ub.token, "POST", { delegationId: delegate!.id, revision: r.revision }, [200, 409])));
    check("57-delegation-limit-one-winner", Number(!!one.record) + Number(!!two.record) === 1);
    const issued = one.record ?? two.record;
    check("57-emission-identifies-both-actors", issued.data.values.autorizador === ua.id && issued.data.values.digitador === ub.id && issued.data.values.delegacao === delegate!.id);
    const report = await api("57-typist-report", `/api/modules/delegations/report?delegacao=${delegate!.id}`, ub.token);
    check("57-report-lists-issued-document-and-actors", report.records.length === 1 && report.records[0].id === issued.id && report.records[0].authorizer === ua.name && report.records[0].typist === ub.name);
    const outsideReport = await api("57-authorizer-report-respects-document-scope", `/api/modules/delegations/report?delegacao=${delegate!.id}`, ua.token);
    check("57-report-no-disclosure-outside-document-scope", outsideReport.records.length === 0 && outsideReport.delegation.used === "1");
    await api("57-unrelated-report-denied", `/api/modules/delegations/report?delegacao=${delegate!.id}`, uc.token, "GET", undefined, [404]);
    delegate = (await api("57-refresh-usage-count", `/api/modules/records/${delegate!.id}`, ua.token)).record;
    delegate = await change(delegate!, "CANCELAR");
    await api("57-cancelled-grant-rejected", `/api/modules/records/${drafts[0].id}/delegation`, ub.token, "POST", { delegationId: delegate!.id, revision: drafts[0].revision }, [400, 403, 409]);
  });
  await scenario("57-diary-classification-and-immutable-publication", async () => {
    const node = await api("57-create-owned-notebook", "/api/modules/diary-catalog", ua.token, "PUT", { parentId: null, kind: "CADERNO", name: "Administração de Aurora das Veredas", position: 99000, active: true, revision: 0, note: "Organização administrativa municipal." }); own("module_diary_catalog", node.id);
    let act = (await api("57-create-official-act", "/api/modules/atos", ua.token, "POST", { title: "Organização do atendimento municipal", body: "Fica estabelecido o horário de atendimento ao cidadão.", values: { especie: "Portaria" } }, [201])).record;
    act = await change(act, "PROTOCOLAR");
    let edition = (await api("57-create-edition", "/api/modules/diario", ua.token, "POST", { title: "Boletim administrativo municipal", values: { tipo: "Extraordinária", data: new Date().toISOString().slice(0, 10), caderno: node.name, secao: "Administração" } }, [201])).record;
    edition = await change(edition, "PREPARAR_EDICAO", ua, { actIds: [act.id] });
    await change(edition, "PUBLICAR", ua, { mode: "INFORMATIVA", acknowledgeUnsigned: true }, 400);
    edition = await api("57-organize-edition-catalog", `/api/modules/diary-catalog/editions/${edition.id}`, ua.token, "PUT", { revision: edition.revision, note: "Classificação dos atos do expediente.", items: [{ id: act.id, catalogId: node.id, withdrawn: false }] });
    edition = await change(edition, "PUBLICAR", ua, { mode: "INFORMATIVA", acknowledgeUnsigned: true });
    const sealed = edition.data.sealedHash;
    await change(edition, "EDITAR", ua, { title: "Conteúdo modificado" }, 409);
    await api("57-published-edition-organization-blocked", `/api/modules/diary-catalog/editions/${edition.id}`, ua.token, "PUT", { revision: edition.revision, note: "Tentativa de nova organização.", items: [{ id: act.id, catalogId: node.id, withdrawn: true }] }, [400]);
    const month = new Date().toISOString().slice(0, 7);
    const publicList = await api("57-public-calendar-content-search", `/api/modules/editions?month=${month}&q=horário`);
    const publicEdition = publicList.editions.find((e: Row) => e.id === edition.id);
    check("57-public-diary-hash-and-unsigned-state", publicEdition?.hash === sealed && publicEdition.publicationMode === "INFORMATIVA" && publicEdition.acts.length === 1);
    check("57-public-diary-hides-internal-fields", !["ownerId", "participants", "publicKey", "externalOwnerUid"].some(key => key in publicEdition));
  });
  await scenario("57-queue-pdf-zip-full-custom-and-download", async () => {
    browserFlow = (await api("57-configure-browser-workflow", "/api/modules/fluxos", ua.token, "POST", { title: "Atendimento de iluminação pública", body: "Manutenção dos equipamentos de iluminação.", values: { externalEnabled: "Sim" }, workflow: { family: "processos", fields: [], steps: [{ name: "Instrução conjunta", hours: 8, departments: [a, b] }, { name: "Decisão administrativa", hours: 16, departments: [b], decision: true }], requiredFiles: [] } }, [201])).record;
    browserFlow = await change(browserFlow!, "ATIVAR");
    browserProcess = (await api("57-browser-process", "/api/modules/processos", ua.token, "POST", { title: "Manutenção da iluminação de Aurora das Veredas", body: "Solicitação para manutenção da iluminação pública.", workflowId: browserFlow!.id }, [201])).record;
    const first = await upload(browserProcess!); await upload((await api("57-before-second-upload", `/api/modules/records/${browserProcess!.id}`, ua.token)).record);
    browserProcess = (await api("57-browser-process-current", `/api/modules/records/${browserProcess!.id}`, ua.token)).record;
    browserProcess = await change(browserProcess!, "PROTOCOLAR");
    const { workerTick } = await import("../src/lib/jobs/worker");
    for (const [kind, selection] of [["PDF", "complete"], ["PDF", "custom"], ["ZIP", "complete"], ["ZIP", "custom"]]) {
      const job = (await api(`57-enqueue-${kind}-${selection}`, "/api/jobs", ua.token, "POST", { kind, selection, sources: [{ type: "module", id: browserProcess!.id }], ...(selection === "custom" ? { fileIds: [first] } : {}), idempotencyKey: randomUUID() }, [202])).job;
      check(`57-targeted-worker-${kind}-${selection}`, await workerTick(job.id));
      const output = (await api(`57-completed-${kind}-${selection}`, `/api/jobs/${job.id}`, ua.token)).job;
      check(`57-${kind}-${selection}-succeeded-with-hash`, output.status === "SUCCEEDED" && /^[a-f0-9]{64}$/.test(output.outputHash));
      const response = await fetch(h.base + output.downloadUrl, { headers: { authorization: `Bearer ${ua.token}` } });
      const bytes = Buffer.from(await response.arrayBuffer());
      check(`57-${kind}-${selection}-authenticated-original-hash`, response.ok && createHash("sha256").update(bytes).digest("hex") === output.outputHash);
      writeFileSync(join(h.dir, `process-${kind}-${selection}.private.${kind.toLowerCase()}`), bytes, { mode: 0o600 });
      if (kind === "PDF") {
        const compiled = await PDFDocument.load(bytes);
        check(`57-${selection}-pdf-cover-content-and-selected-originals`, compiled.getPageCount() === (selection === "complete" ? 4 : 3));
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); const loaded = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
        const page = await loaded.getPage(loaded.numPages), text = (await page.getTextContent()).items.map(i => "str" in i ? i.str : "").join(" ");
        check(`57-${selection}-compiled-pdf-pagination`, text.includes(`${loaded.numPages} / ${loaded.numPages}`)); await loaded.destroy();
      } else {
        const end = bytes.length - 22, count = bytes.readUInt16LE(end + 10); let position = bytes.readUInt32LE(end + 16), originals = 0;
        for (let i = 0; i < count; i++) {
          check("57-zip-central-directory-signature", bytes.readUInt32LE(position) === 0x02014b50);
          const size = bytes.readUInt32LE(position + 24), nameSize = bytes.readUInt16LE(position + 28), extra = bytes.readUInt16LE(position + 30), comment = bytes.readUInt16LE(position + 32), local = bytes.readUInt32LE(position + 42);
          const name = bytes.subarray(position + 46, position + 46 + nameSize).toString("utf8");
          if (name.startsWith("originais/")) {
            const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
            check("57-zip-original-bytes-preserved", bytes.subarray(start, start + size).equals(original)); originals++;
          }
          position += 46 + nameSize + extra + comment;
        }
        check(`57-${selection}-zip-preserves-selected-originals`, originals === (selection === "complete" ? 2 : 1));
      }
      await api(`57-outsider-download-${kind}-${selection}`, `/api/jobs/${job.id}/download`, uc.token, "GET", undefined, [404]);
    }
    service = (await api("57-create-service-charter", "/api/modules/carta", ua.token, "POST", { title: "Iluminação pública de Aurora das Veredas", body: "Reparo dos equipamentos da iluminação municipal.", values: { ...values("carta"), categoria: "Urbanismo", publico: "Moradores", prazo: "Dois dias úteis", assuntoId: browserFlow!.id } }, [201])).record;
    service = await change(service!, "ATIVAR");
  });
  await scenario("57-browser-role-workflow-service-report", async () => {
    check("57-browser-prerequisites", browserFlow && browserProcess && service && delegate);
    const browser = await chromium.launch({ executablePath: process.env.JOBS_CHROMIUM_BIN ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
    const login = async (page: Page, u: Row) => {
      await page.goto(h.base + "/admin"); await page.getByLabel("E-mail", { exact: true }).fill(u.email); await page.getByLabel("Senha", { exact: true }).fill(u.password); await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.getByText(u.email, { exact: false }).first().waitFor({ timeout: 60000 });
    };
    try {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); await login(page, ua);
      await page.goto(`${h.base}/gestao/registros/${browserProcess!.id}`); await page.getByRole("button", { name: "Fluxo e respostas", exact: true }).click();
      check("57-browser-cannot-skip-or-decide-before-sector-completion", await page.getByRole("button", { name: "Avançar etapa", exact: true }).count() === 0 && await page.getByRole("button", { name: "Deferir", exact: true }).count() === 0);
      await page.getByRole("button", { name: /Concluir participação —/ }).click(); await page.getByText("Operação registrada.", { exact: true }).waitFor();
      check("57-browser-one-sector-does-not-unlock-next-stage", await page.getByRole("button", { name: "Avançar etapa", exact: true }).count() === 0);
      const observer = await browser.newPage({ viewport: { width: 1366, height: 768 } }); await login(observer, n3);
      await observer.goto(`${h.base}/gestao/registros/${browserProcess!.id}`); await observer.getByRole("button", { name: "Fluxo e respostas", exact: true }).click();
      check("57-browser-n3-no-mutating-actions", await observer.getByRole("button", { name: /Concluir participação|Cancelar registro|Registrar resposta|Protocolar/ }).count() === 0 && await observer.getByRole("link", { name: "Administração", exact: true }).count() === 0);
      await observer.goto(`${h.base}/gestao/processos/novo`); await observer.getByText("Seu perfil permite consultar este módulo.", { exact: false }).waitFor(); check("57-browser-direct-new-route-does-not-offer-n3-form", await observer.getByRole("button", { name: "Salvar rascunho", exact: true }).count() === 0);
      const typist = await browser.newPage({ viewport: { width: 1366, height: 768 } }); await login(typist, ub);
      await typist.goto(`${h.base}/gestao/delegacoes/emissoes?delegacao=${delegate!.id}`); await typist.getByRole("heading", { name: /Documentos por autorização/ }).waitFor(); await typist.getByRole("cell", { name: ua.name, exact: true }).waitFor();
      check("57-browser-delegation-report-fixed-desktop-table", await typist.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)); await typist.screenshot({ path: join(h.dir, "delegation-report.png") });
      const publicPage = await browser.newPage({ viewport: { width: 1366, height: 768 } }); await publicPage.goto(h.base + "/gestao/servicos"); await publicPage.getByRole("button", { name: "Filtros", exact: true }).click();
      await publicPage.getByLabel("O que você precisa?", { exact: true }).fill("preciso trocar a lampada"); await publicPage.getByRole("combobox", { name: /^Categoria/ }).selectOption("Urbanismo"); await publicPage.getByRole("button", { name: "Voltar à listagem", exact: true }).click();
      await publicPage.getByRole("button", { name: service!.title, exact: true }).click(); await publicPage.getByRole("heading", { name: service!.title, exact: true }).waitFor();
      check("57-browser-charter-links-selected-workflow", (await publicPage.getByRole("link", { name: "Solicitar atendimento", exact: true }).getAttribute("href"))?.includes(browserFlow!.id));
      await publicPage.screenshot({ path: join(h.dir, "service-charter.png") });
    } catch (error) {
      writeFileSync(join(h.dir, "57-browser-failure.private.txt"), String((error as Error).stack ?? error), { mode: 0o600 });
      for (const [i, context] of browser.contexts().entries()) for (const [j, page] of context.pages().entries()) {
        await page.screenshot({ path: join(h.dir, `57-failure-${i}-${j}.png`), fullPage: true }).catch(() => {});
        writeFileSync(join(h.dir, `57-failure-${i}-${j}.private.txt`), await page.locator("body").innerText().catch(() => "Unavailable"), { mode: 0o600 });
      }
      throw error;
    } finally { await browser.close(); }
  });
}
