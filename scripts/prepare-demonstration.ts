/** Explicit, additive operational examples. Never imported by the application. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { chromium } from "playwright-core";
import { firebaseAdminAuth } from "../src/lib/firebase-admin";
import { families, processFamilies, type Family } from "../src/lib/modules/domain";

type Row = Record<string, any>;
async function main() {
  const args = process.argv.slice(2), option = (key: string) => args[args.indexOf(key) + 1];
  const base = option("--base"), directory = resolve(option("--directory") || "");
  const root = resolve(process.env.LOCALAPPDATA!, "Temp/opencode");
  assert.ok(args.includes("--apply") && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base), "Use --apply --base http://localhost:PORT --directory <diretório privado>.");
  assert.ok(directory.startsWith(root + "\\") || directory.startsWith(root + "/"));
  mkdirSync(directory, { recursive: true });
  if (args.includes("--tools")) {
    const config = JSON.parse(readFileSync(resolve(option("--tools")), "utf8")) as Record<string, string>;
    for (const [key, value] of Object.entries(config)) { assert.match(key, /^(JOBS_[A-Z_]+|TESSDATA_PREFIX)$/); process.env[key] = value; }
  }
  process.env.JOBS_CHROMIUM_BIN ??= "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  process.env.JOBS_TEMP_DIR = join(directory, "worker"); mkdirSync(process.env.JOBS_TEMP_DIR, { recursive: true });
  const sql = neon(process.env.DATABASE_URL!), auth = firebaseAdminAuth();
  const manifest = join(directory, "manifest.private.json");
  const journal: Row = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")) : { version: 1, municipality: "Aurora das Veredas/MG", source: "Fictitious operational examples authorized for presentation; no real civil identity, official receipt or institutional legal validity is asserted.", database: createHash("sha256").update(process.env.DATABASE_URL!).digest("hex"), base, resources: {}, keys: {}, credentials: {}, evidence: [], pending: null };
  assert.equal(journal.database, createHash("sha256").update(process.env.DATABASE_URL!).digest("hex"));
  const save = () => writeFileSync(manifest, JSON.stringify(journal, null, 2), { mode: 0o600 });
  const key = (label: string) => { if (!journal.keys[label]) { journal.keys[label] = randomUUID(); save(); } return journal.keys[label] as string; };
  const once = async (label: string, action: () => Promise<any>) => {
    if (Object.hasOwn(journal.resources, label)) return journal.resources[label];
    assert.ok(!journal.pending, "Há escrita de resultado incerto; confira o manifesto antes de retomar.");
    journal.pending = label; save();
    try { const value = await action(); journal.resources[label] = value ?? true; journal.pending = null; save(); return journal.resources[label]; }
    catch (error) { if ((error as { definitive?: boolean }).definitive) { journal.pending = null; save(); } writeFileSync(join(directory, "failure.private.txt"), String((error as Error).stack ?? error), { mode: 0o600 }); throw error; }
  };
  const api = async (path: string, token: string, method = "GET", body?: unknown) => {
    const response = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body instanceof FormData ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const value = await response.json();
    journal.evidence.push({ at: new Date().toISOString(), path: path.replace(/[a-f0-9-]{36}/gi, "<id>"), method, status: response.status }); save();
    if (!response.ok) throw Object.assign(new Error(`${method} ${path}: ${response.status} ${JSON.stringify(value)}`), { definitive: response.status < 500 });
    return value;
  };
  const token = async (uid: string) => {
    const custom = await auth.createCustomToken(uid);
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }), signal: AbortSignal.timeout(30000) });
    const value = await response.json(); assert.ok(response.ok && value.idToken, "Firebase session"); return String(value.idToken);
  };
  const [administrator] = await sql("SELECT u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND r.name='ADMIN_GERAL' AND u.firebase_uid IS NOT NULL ORDER BY u.id LIMIT 1");
  assert.ok(administrator); const bootstrap = await token(administrator.firebase_uid);
  const sectors: Record<string, Row> = {};
  for (const [slug, name, acronym] of [
    ["administracao", "Secretaria Municipal de Administração", "AV-ADM"], ["protocolo", "Protocolo e Atendimento ao Cidadão", "AV-PROT"], ["rh", "Gestão de Pessoas", "AV-RH"], ["juridico", "Procuradoria Municipal", "AV-PGM"], ["engenharia", "Urbanismo e Engenharia", "AV-URB"], ["ambiental", "Meio Ambiente e Fiscalização", "AV-AMB"], ["ouvidoria", "Ouvidoria e Acesso à Informação", "AV-OUV"], ["tecnologia", "Tecnologia da Informação", "AV-TI"],
  ]) sectors[slug] = await once(`department:${slug}`, () => api("/api/admin/departments", bootstrap, "POST", { name: `Aurora das Veredas — ${name}`, acronym, ...(slug === "administracao" ? {} : { parentId: sectors.administracao.id }) }));
  const allSectors = Object.values(sectors).map(s => s.id);
  const staff: Record<string, Row> = {};
  for (const [slug, name, role, sector, position] of [
    ["helena", "Helena Duarte", "ADMIN_GERAL", "administracao", "Coordenadora de Gestão Documental"],
    ["marcos", "Marcos Azevedo", "NIVEL_1", "engenharia", "Coordenador de Urbanismo"],
    ["clara", "Clara Ribeiro", "NIVEL_2", "protocolo", "Agente de Atendimento"],
    ["rafael", "Rafael Nogueira", "NIVEL_3_VISUALIZACAO", "administracao", "Analista de Consulta"],
    ["laura", "Laura Antunes", "AUDITOR", "administracao", "Controladora Interna"],
    ["renata", "Renata Paiva", "ADMIN_LOCAL", "rh", "Gestora de Pessoas"],
  ]) {
    journal.credentials[slug] ??= { name, role, email: `${slug}.${name.split(" ").at(-1)!.toLowerCase()}@aurora.mg.gov.br`, password: randomBytes(24).toString("base64url") }; save();
    staff[slug] = await once(`user:${slug}`, () => api("/api/admin/users", bootstrap, "POST", { ...journal.credentials[slug], departmentId: sectors[sector].id, position, registration: `AV-${String(Object.keys(staff).length + 1).padStart(4, "0")}`, phone: "(38) 98841-2706", secondaryDepartmentIds: slug === "helena" || slug === "rafael" ? allSectors.filter(id => id !== sectors[sector].id) : [], administrativeDepartmentIds: role === "ADMIN_LOCAL" ? [sectors.administracao.id] : [], details: { birthDate: "1988-04-18", sex: "Não informado", editor: "AVANCADO" } }));
  }
  writeFileSync(join(directory, "access.private.json"), JSON.stringify({ origin: "https://rioazul.celeriflow.com.br", path: "/admin", accounts: journal.credentials }, null, 2), { mode: 0o600 });
  const bearer = await token(staff.helena.firebaseUid), reader = await token(staff.rafael.firebaseUid);
  for (const [slug, sector] of Object.entries(sectors)) await once(`hours:${slug}`, () => api("/api/modules/business-hours", bearer, "PUT", { departmentId: sector.id, revision: 0, active: true, shifts: [1, 2, 3, 4, 5].flatMap(day => [{ day, start: "08:00", end: "12:00" }, { day, start: "13:00", end: "17:00" }]), note: "Expediente administrativo de Aurora das Veredas." }));
  await once("holiday:2026-11-20", async () => {
    const existing = await sql("SELECT date FROM calendar_holiday WHERE date='2026-11-20'");
    return existing.length ? { preservedExisting: true } : api("/api/admin/holidays", bearer, "POST", { date: "2026-11-20", title: "Dia Nacional de Zumbi e da Consciência Negra" });
  });
  const profile = await once("contact-profile", () => api("/api/modules/contatos/perfis", bearer, "POST", { name: "Atendimento municipal — pessoas e organizações", active: true, definition: { types: ["Pessoa física", "Pessoa jurídica", "Setor de organização"], base: ["cpfCnpj", "email", "phone", "cep", "endereco", "organizacao"].map(key => ({ key, enabled: true, required: key === "email" })), fields: [{ key: "extra_bairro", label: "Bairro", type: "text", required: true, channel: "AMBOS", help: "Informe o bairro do endereço de atendimento.", options: [] }, { key: "extra_vinculo", label: "Vínculo com o Município", type: "select", required: false, channel: "INTERNO", help: "Classificação para o atendimento setorial.", options: ["Morador", "Prestador", "Associação"] }] } }));
  const contacts: Row[] = [];
  for (const [slug, title, tipo, tax, email, address, extra_vinculo] of [
    ["moradora", "Beatriz Moreira", "Pessoa física", "38469125737", "beatriz.moreira@aurora.mg.gov.br", "Rua das Quaresmeiras, 215 — Aurora das Veredas/MG", "Morador"],
    ["associacao", "Associação Cultural das Veredas", "Pessoa jurídica", "47286195000141", "contato@culturaldasveredas.example", "Praça das Veredas, 80 — Aurora das Veredas/MG", "Associação"],
    ["engenheiro", "Gustavo Almeida", "Pessoa física", "70294618350", "gustavo.almeida@aurora.mg.gov.br", "Avenida Ipês do Cerrado, 460 — Aurora das Veredas/MG", "Prestador"],
  ]) {
    const values = { tipo, cpfCnpj: tax, email, phone: `3898841270${6 + contacts.length}`, cep: "39100000", endereco: address, organizacao: tipo === "Pessoa jurídica" ? title : "", extra_bairro: "Centro", extra_vinculo };
    const contact = await once(`contact:${slug}`, () => api("/api/modules/contatos", bearer, "POST", { title, profileId: profile.id, profileRevision: 1, idempotencyKey: key(`contact:${slug}`), values }));
    await once(`contact-checked:${slug}`, async () => { const current = await api(`/api/modules/contatos/${contact.id}`, bearer); if (current.values.cpfCnpj === tax && current.values.phone === values.phone) return true; return api(`/api/modules/contatos/${contact.id}`, bearer, "PATCH", { title, profileId: profile.id, profileRevision: 1, revision: current.revision, values }); });
    contacts.push(contact);
  }
  await once("contact-segment", () => api("/api/modules/contatos/segmentos", bearer, "POST", { name: "Conselho de Desenvolvimento Cultural", description: "Contatos para encaminhamento de projetos e reuniões do centro cultural.", departmentId: sectors.administracao.id, members: contacts.map(c => c.id) }));
  const pdf = async (title: string, lines: string[], plan = false) => {
    const doc = await PDFDocument.create(), page = doc.addPage([595.28, 841.89]), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
    page.drawText("MUNICIPIO DE AURORA DAS VEREDAS / MG", { x: 42, y: 790, font: bold, size: 13 });
    page.drawText(title, { x: 42, y: 754, font: bold, size: 13 });
    lines.forEach((line, i) => page.drawText(line, { x: 42, y: 720 - i * 24, font, size: 10, maxWidth: 510 }));
    if (plan) { page.drawRectangle({ x: 80, y: 250, width: 300, height: 180, borderColor: rgb(0.1, 0.2, 0.4), borderWidth: 1 }); page.drawText("Centro cultural: 30,00 m x 18,00 m", { x: 80, y: 230, font, size: 10 }); page.drawText("Norte / Acesso pela Praca das Veredas / Referencia: 0,10 m por ponto", { x: 60, y: 190, font, size: 9 }); }
    return Buffer.from(await doc.save());
  };
  const attachment = await pdf("Plano de trabalho - Centro Cultural das Veredas", ["Objeto: adequacao dos ambientes de oficinas e biblioteca comunitaria.", "Local: Praca das Veredas, 80 - Centro.", "Etapas: levantamento, analise tecnica, deliberacao e acompanhamento.", "Prazo administrativo: 30 dias; valor de referencia: R$ 184.750,00."]);
  const memorandum = await once("core:memorandum", () => api("/api/documents", bearer, "POST", { type: "MEMORANDUM", subject: "Adequação do Centro Cultural das Veredas", body: "<h2>Plano de trabalho intersetorial</h2><p>Solicito análise técnica para adequação do centro cultural, com acessibilidade, drenagem e reorganização da biblioteca comunitária.</p><table><tbody><tr><th>Etapa</th><th>Responsável</th></tr><tr><td>Levantamento e orçamento</td><td>Urbanismo e Engenharia</td></tr><tr><td>Conferência administrativa</td><td>Administração</td></tr></tbody></table><p>Valor de referência: R$ 184.750,00.</p>", originDepartmentId: sectors.administracao.id, toDepartmentIds: [sectors.engenharia.id, sectors.ambiental.id], deadlines: [{ title: "Apresentar levantamento técnico", dueAt: "2026-11-23T20:00:00Z" }, { title: "Consolidar parecer e orçamento", dueAt: "2026-11-30T20:00:00Z" }] }));
  await once("core:read", () => api(`/api/documents/${memorandum.id}`, bearer));
  await once("core:attachment", async () => { const form = new FormData(); form.set("file", new File([new Uint8Array(attachment)], "plano-de-trabalho.pdf", { type: "application/pdf" })); return api(`/api/documents/${memorandum.id}/attachments`, bearer, "POST", form); });
  await once("core:receive", () => api(`/api/documents/${memorandum.id}/receive`, bearer, "POST", { departmentId: sectors.engenharia.id }));
  await once("core:reply", () => api(`/api/documents/${memorandum.id}/actions?action=reply`, bearer, "POST", { departmentId: sectors.engenharia.id, note: "Levantamento do imóvel concluído. Recomenda-se adequar a rampa de acesso e a drenagem do passeio antes da abertura das oficinas." }));
  const circular = await once("core:circular", () => api("/api/circulars", bearer, "POST", { subject: "Organização do atendimento e encaminhamento de documentos", body: "<p>O atendimento ao público ocorre das 8h às 12h e das 13h às 17h. Os requerimentos devem ser classificados e encaminhados ao setor competente, com confirmação de recebimento.</p>", originDepartmentId: sectors.administracao.id, departmentIds: [sectors.protocolo.id, sectors.rh.id, sectors.tecnologia.id], urgency: "INFORMATIVE", circularReplyMode: "OPEN" }));
  await once("core:circular-read", () => api(`/api/circulars/${circular.id}/read`, bearer, "POST", {}));
  const records: Record<string, Row> = {};
  const record = async (slug: string, family: Family, input: Row) => {
    const created = await once(`module:${slug}`, async () => (await api(`/api/modules/${family}`, bearer, "POST", { ...input, tags: ["Aurora das Veredas"], idempotencyKey: key(`module:${slug}`) })).record);
    records[slug] = created; return created;
  };
  const read = async (id: string) => (await api(`/api/modules/records/${id}`, bearer)).record;
  const command = (slug: string, id: string, action: string, payload: Row = {}, note = "Conferência e encaminhamento pela Administração de Aurora das Veredas.") => once(`command:${slug}`, async () => { const current = await read(id); return (await api(`/api/modules/records/${id}`, bearer, "PATCH", { revision: current.revision, action, payload, note })).record; });
  const upload = (slug: string, id: string, bytes: Buffer, filename: string, category: string) => once(`file:${slug}`, async () => { const form = new FormData(); form.set("file", new File([new Uint8Array(bytes)], filename, { type: "application/pdf" })); form.set("category", category); return api(`/api/modules/records/${id}/files`, bearer, "POST", form); });
  const classification = await record("classificacao", "classificacao", { title: "Gestão de equipamentos culturais", body: "Documentos de planejamento, adequação e manutenção dos equipamentos culturais.", values: { nivel1: "Administração geral", nivel2: "Patrimônio público", nivel3: "Equipamentos culturais", nivel4: "Obras e manutenção", retencao: "5 anos após encerramento", destinacao: "Avaliação pela comissão de arquivos" } });
  await command("classificacao-ativa", classification.id, "ATIVAR");
  const model = await record("modelo", "modelos", { title: "Parecer técnico de adequação de equipamento público", body: "PARECER TÉCNICO\nInteressado: {{interessado}}\nObjeto: {{objeto}}\nAnálise: {{analise}}\nConclusão: {{conclusao}}", values: { variaveis: "interessado,objeto,analise,conclusao" } });
  await command("modelo-ativo", model.id, "ATIVAR");
  const law = await record("legislacao", "legislacao", { title: "Aurora das Veredas — Lei de uso e ocupação do solo", body: "Lei municipal n.º 128/2026. Zona Central: uso institucional e cultural, coeficiente máximo 2,0, ocupação máxima de 60% e permeabilidade mínima de 20%.", values: { numero: "128/2026", vigencia: "2026-01-01", zona: "Zona Central", usos: "Institucional, cultural e serviços de interesse público", ocupacaoMaxima: "60", coeficienteMaximo: "2", permeabilidadeMinima: "20", publicar: "Sim" } });
  await command("legislacao-ativa", law.id, "ATIVAR");
  const flowMap: Record<string, Row> = {};
  const sectorFor: Partial<Record<Family, string>> = { pessoal: "rh", pad: "rh", judicial: "juridico", seletivo: "rh", projetos: "engenharia", ambiental: "ambiental", fiscalizacao: "ambiental", ouvidoria: "ouvidoria", esic: "ouvidoria", chamados: "tecnologia", processos: "administracao" };
  const titles: Record<string, string> = { processos: "Aquisição e manutenção de equipamentos públicos", chamados: "Suporte a equipamentos e rede municipal", ouvidoria: "Atendimento e apuração de manifestações", esic: "Solicitação de informação pública", pessoal: "Solicitação funcional à Gestão de Pessoas", pad: "Apuração administrativa e direito de defesa", judicial: "Acompanhamento de demandas judiciais", seletivo: "Inscrição em seleção pública", projetos: "Aprovação de construção e parcelamento", ambiental: "Licenciamento de atividades municipais", fiscalizacao: "Fiscalização de obras e posturas" };
  for (const family of processFamilies) {
    const sector = sectors[sectorFor[family] || "administracao"].id;
    const flow = await record(`fluxo-${family}`, "fluxos", { title: titles[family], body: "Recepção, análise e decisão fundamentada, com registro das etapas e prazos de atendimento.", values: { externalEnabled: ["pessoal", "pad", "judicial"].includes(family) ? "Não" : "Sim", anonymousEnabled: family === "ouvidoria" ? "Sim" : "Não" }, workflow: { family, fields: [{ key: "referencia", label: "Referência do atendimento", type: "text", required: false, help: "Informe a referência do imóvel, equipamento ou expediente.", options: [] }], steps: [{ name: "Análise e instrução", departments: [sector], hours: 48, decision: false }, { name: "Decisão fundamentada", departments: [sector], hours: 48, decision: true }], requiredFiles: family === "projetos" ? ["Planta"] : [], businessDays: true, ...(family === "pessoal" ? { rhDepartmentId: sector } : {}), ...(family === "ouvidoria" ? { identityDepartmentId: sector } : {}) } });
    await command(`fluxo-${family}-ativo`, flow.id, "ATIVAR"); flowMap[family] = flow;
  }
  const examples: Partial<Record<Family, Row>> = {
    processos: { title: "Aquisição de mobiliário para a Biblioteca das Veredas", body: "Aquisição de estantes, mesas acessíveis e cadeiras para ampliação do atendimento. Estimativa de R$ 48.600,00 e planejamento de entrega em duas etapas.", values: { referencia: "Plano de trabalho do Centro Cultural" } },
    chamados: { title: "Instabilidade da rede no atendimento ao cidadão", body: "O terminal do balcão 2 apresenta quedas de conexão durante anexação de documentos. Verificar cabeamento, ponto de rede e atualização do equipamento.", values: { patrimonio: "AV-TI-00142", prioridade: "Alta" } },
    ouvidoria: { title: "Adequação do passeio próximo à biblioteca", body: "Solicita-se verificar o desnível do passeio e a continuidade da faixa acessível na Praça das Veredas, próximo à entrada da biblioteca.", values: { modalidade: "Identificada", finalidade: "Solicitação" }, identity: { name: "Beatriz Moreira", email: "beatriz.moreira@aurora.mg.gov.br", cpfCnpj: "38469125737", phone: "38988412706" } },
    esic: { title: "Informações sobre investimentos em equipamentos culturais", body: "Solicito a relação de despesas e os cronogramas de adequação dos equipamentos culturais municipais no exercício de 2026.", values: { canal: "Presencial" } },
    pessoal: { title: "Participação em capacitação de gestão documental", body: "Solicito autorização para participação em formação sobre classificação, temporalidade e atendimento ao cidadão, sem prejuízo do expediente do setor.", values: { referencia: "Plano anual de desenvolvimento de pessoas" } },
    pad: { title: "Apuração de divergência no inventário patrimonial", body: "Instrução preliminar para conferir registros de movimentação de mobiliário. Assegurar contraditório, acesso restrito e preservação dos documentos de origem.", values: { infracao: "Divergência de registro em movimentação de bens", portaria: "Portaria de instauração 42/2026", comissao: "Comissão de Inventário e Apuração Administrativa" } },
    judicial: { title: "Acompanhamento de regularização de área pública", body: "Organização de informações e documentos para análise jurídica de regularização de imóvel destinado a equipamento público.", values: { segmento: "Estadual", numeroProcesso: `0000142-${String(BigInt(98) - BigInt("00001422026813000000") % BigInt(97)).padStart(2, "0")}.2026.8.13.0000`, vara: "Vara da Fazenda Pública", autor: "Município de Aurora das Veredas", pasta: "Patrimônio imobiliário", tipoAcao: "Regularização dominial", liminar: "Sem decisão liminar", precatorio: "Não se aplica" } },
    seletivo: { title: "Inscrição para agente de atendimento cultural", body: "Inscrição de Beatriz Moreira para atuação no atendimento da biblioteca comunitária. Documentação a conferir conforme critérios do edital.", values: { edital: "Edital 07/2026", vaga: "Agente de Atendimento Cultural", candidato: "Beatriz Moreira", cpfCnpj: "38469125737" } },
    projetos: { title: "Adequação e ampliação do Centro Cultural das Veredas", body: "Reorganização da biblioteca, oficinas e sanitários acessíveis. Terreno de 1.200 m², construção de 720 m², projeção de 540 m² e área permeável de 360 m².", values: { tipo: "Construção", inscricao: "01.02.003.0080.001", proprietario: "Associação Cultural das Veredas", responsavel: "Gustavo Almeida — Engenharia Civil", areaTerreno: "1200", areaConstruida: "720", areaProjecao: "540", areaPermeavel: "360", legislacaoId: law.id } },
    ambiental: { title: "Licença para adequação do Centro Cultural das Veredas", body: "Análise ambiental da intervenção com manejo de águas pluviais, segregação de resíduos e preservação da arborização existente.", values: { licenca: "LAP", empreendimento: "Centro Cultural das Veredas", atividade: "Atividades de organizações associativas ligadas à cultura — CNAE 94.93-6/00", validade: "2027-11-30" } },
    fiscalizacao: { title: "Vistoria de acessibilidade e drenagem do centro cultural", body: "Verificação das condições de acesso, passeio e drenagem na Praça das Veredas, vinculada ao projeto de adequação do centro cultural.", values: { objeto: "Obra de adequação do equipamento cultural", endereco: "Praça das Veredas, 80 — Centro — Aurora das Veredas/MG", latitude: "-18.5004", longitude: "-43.9503", checklist: "Conferir faixa livre, acesso à biblioteca e captação de águas pluviais.", providencias: "Registrar orientação ao responsável e acompanhar complementações." } },
  };
  for (const family of processFamilies) {
    const input = examples[family]!;
    const created = await record(family, family, { ...input, workflowId: flowMap[family].id, coreDocumentIds: [memorandum.id], ...(family === "ambiental" || family === "fiscalizacao" ? { linkedIds: [records.projetos.id] } : {}) });
    if (family === "projetos") await upload("planta", created.id, await pdf("Planta - Centro Cultural das Veredas", ["Inscricao: 01.02.003.0080.001 / Praca das Veredas, 80.", "Terreno: 1.200,00 m2 / Construcao: 720,00 m2.", "Projecao: 540,00 m2 / Area permeavel: 360,00 m2.", "Levantamento e adequacao do acesso principal."], true), "planta-centro-cultural.pdf", "Planta");
    await command(`${family}-protocolado`, created.id, "PROTOCOLAR");
    await command(`${family}-resposta`, created.id, "RESPONDER", { text: family === "fiscalizacao" ? "Vistoria agendada para conferência da faixa acessível e drenagem do passeio." : "Documentação recebida e encaminhada à análise do setor responsável.", visibility: "INTERNA" });
  }
  const plant = journal.resources["file:planta"];
  const [plantInfo] = await sql("SELECT sha256 FROM module_file WHERE id=$1", [plant.id]);
  await command("projeto-medicao", records.projetos.id, "MEDIR", { fileId: plant.id, fileHash: plantInfo.sha256, page: 1, scale: 0.1, type: "area", shape: "rectangle", points: [[80, 411.89], [380, 591.89]], coordinateSystem: "PDF_VIEWPORT_POINTS", color: "#2563eb", width: 2, opacity: 0.8, precision: 2 });
  await command("projeto-anexo-aceito", records.projetos.id, "REVISAR_ANEXO", { fileId: plant.id, status: "ACEITO", note: "Dimensões do equipamento e legenda conferidas com o levantamento apresentado." });
  await once("project-annotation", async () => api(`/api/modules/records/${records.projetos.id}/annotate`, bearer, "POST", { revision: (await read(records.projetos.id)).revision, fileId: plant.id, stamp: "Conferencia tecnica - Aurora das Veredas" }));
  const fieldFile = await upload("vistoria", records.fiscalizacao.id, await pdf("Relatorio de campo - acesso e drenagem", ["Local: Praca das Veredas, 80 - Centro.", "Constatacao: faixa livre preservada; ajustar encontro da rampa com o passeio.", "Drenagem: complementar grelha de captacao antes da abertura ao publico.", "Providencia: apresentar detalhe executivo e registrar nova visita."]), "relatorio-vistoria.pdf", "Relatório de campo");
  await command("vistoria-registrada", records.fiscalizacao.id, "REGISTRAR_VISTORIA", { operationId: key("inspection"), capturedAt: "2026-11-10T14:30:00-03:00", latitude: -18.5004, longitude: -43.9503, findings: "Faixa livre preservada. Ajustar encontro da rampa com o passeio e complementar a captação de águas pluviais.", measures: "Apresentar detalhe executivo da drenagem e programar nova visita após as adequações.", fileIds: [fieldFile.id] });
  await once("project-analysis", () => api(`/api/modules/records/${records.projetos.id}/urban-analysis?lawId=${law.id}`, bearer));
  for (const family of ["processos", "ambiental", "esic"]) {
    const id = records[family].id, sector = sectors[sectorFor[family as Family] || "administracao"].id;
    await command(`${family}-analise-concluida`, id, "CONCLUIR_SETOR", { departmentId: sector });
    await command(`${family}-avanco`, id, "AVANCAR");
    await command(`${family}-decisao-concluida`, id, "CONCLUIR_SETOR", { departmentId: sector });
    await command(`${family}-decisao`, id, "DEFERIR", {}, family === "esic" ? "Informações organizadas e disponibilizadas no atendimento, observadas as restrições de dados pessoais." : "Instrução e análise concluídas. Prosseguir com as providências e condicionantes registradas no processo.");
  }
  const subdivision = await record("desmembramento", "projetos", { title: "Desmembramento de lote na Rua das Quaresmeiras", body: "Proposta de divisão do lote de 600 m² em duas unidades de 300 m², com acesso independente à via pública e preservação dos alinhamentos.", workflowId: flowMap.projetos.id, coreDocumentIds: [memorandum.id], values: { tipo: "Desmembramento", inscricao: "01.03.014.0215.001", proprietario: "Beatriz Moreira", responsavel: "Gustavo Almeida — Engenharia Civil", areaTerreno: "600", areaConstruida: "0", areaProjecao: "0", areaPermeavel: "600", legislacaoId: law.id } });
  await upload("desmembramento", subdivision.id, await pdf("Proposta de desmembramento - Rua das Quaresmeiras", ["Lote original: 600,00 m2 / duas unidades propostas de 300,00 m2.", "Frente de cada unidade: 10,00 m / profundidade: 30,00 m.", "Rua das Quaresmeiras, 215 - Centro - Aurora das Veredas/MG.", "Conferir confrontacoes, matricula e infraestrutura antes da decisao."]), "planta-desmembramento.pdf", "Planta");
  await command("desmembramento-protocolado", subdivision.id, "PROTOCOLAR");
  await command("desmembramento-analise", subdivision.id, "CONCLUIR_SETOR", { departmentId: sectors.engenharia.id });
  await command("desmembramento-avanco", subdivision.id, "AVANCAR");
  await command("desmembramento-etapa-final", subdivision.id, "CONCLUIR_SETOR", { departmentId: sectors.engenharia.id });
  await command("desmembramento-indeferido", subdivision.id, "INDEFERIR", {}, "A instrução não apresentou matrícula atualizada nem comprovação das confrontações. Indeferido o pedido, assegurada nova apresentação após complementação dos documentos.");
  const additional: [string, Family, Row][] = [
    ["ged", "ged", { title: "Memorial de adequação do Centro Cultural das Veredas", body: "<h2>Memorial descritivo</h2><p>Preservação do acervo, acessibilidade e atendimento da comunidade.</p>", classificationId: classification.id }],
    ["parecer", "parecer", { title: "Parecer técnico sobre acessibilidade do centro cultural", body: "A solução deve preservar faixa livre contínua, corrigir a concordância da rampa e detalhar a drenagem superficial. Recomenda-se aprovação condicionada à complementação do detalhe executivo.", values: { natureza: "Técnico", conclusao: "Favorável com condicionantes" }, linkedIds: [records.projetos.id], coreDocumentIds: [memorandum.id] }],
    ["oficio", "oficio", { title: "Encaminhamento de orientações à Associação Cultural das Veredas", body: "Encaminhamos as orientações técnicas referentes à adequação do centro cultural. Solicitamos a apresentação dos detalhes de acessibilidade e drenagem no prazo indicado no atendimento.", values: { recipientContactId: contacts[1].id, destinatario: "Associação Cultural das Veredas", email: "contato@culturaldasveredas.example" }, linkedIds: [records.projetos.id] }],
    ["intimacao", "intimacao", { title: "Complementação do detalhe executivo de drenagem", body: "Apresentar detalhe de captação e destinação de águas pluviais do acesso principal, identificando cotas e materiais.", values: { destinatario: "Associação Cultural das Veredas", prazo: "2026-11-30" }, linkedIds: [records.fiscalizacao.id] }],
    ["pauta", "pauta", { title: "Reunião do Conselho de Desenvolvimento Cultural", body: "Deliberação sobre adequação do centro cultural e programação de oficinas comunitárias.", values: { reuniao: "2026-11-18", local: "Sala de reuniões da Administração — Praça das Veredas, 10" }, agenda: [{ title: "Adequação do acesso à biblioteca", responsible: "Marcos Azevedo", decision: "" }, { title: "Cronograma de oficinas comunitárias", responsible: "Helena Duarte", decision: "" }], attendees: ["Helena Duarte", "Marcos Azevedo", "Beatriz Moreira"] }],
    ["atos", "atos", { title: "Portaria de organização do atendimento cultural", body: "Dispõe sobre a organização do atendimento, a guarda do acervo e o encaminhamento de solicitações do Centro Cultural das Veredas.", values: { especie: "Portaria" } }],
    ["procuracao", "procuracoes", { title: "Representação da Associação Cultural das Veredas", body: "Instrumento para representação administrativa da associação no acompanhamento do projeto de adequação do centro cultural. A eficácia jurídica depende da formalização pelo outorgante.", values: { outorgante: "Associação Cultural das Veredas", outorgado: "Gustavo Almeida", poderes: "Acompanhar o projeto e apresentar documentos técnicos, sem poderes de disposição patrimonial.", validade: "2027-11-30" }, linkedIds: [contacts[1].id, contacts[2].id] }],
    ["delegacao", "delegacoes", { title: "Autorização para redação de expedientes culturais", body: "Autorização limitada à redação e preparação de expedientes administrativos do centro cultural.", values: { digitador: staff.clara.id, limite: "5", validade: "2027-11-30" } }],
    ["carta", "carta", { title: "Análise de projetos de construção e adequação", body: "Recepção e análise técnica de projetos para construção, reforma e adequação de imóveis em Aurora das Veredas.", values: { categoria: "Urbanismo", publico: "Proprietários, entidades e responsáveis técnicos", requisitos: "Requerimento, identificação, comprovação do vínculo com o imóvel e planta PDF.", canais: "Atendimento digital e Protocolo de Aurora das Veredas, Praça das Veredas, 10", prazo: "Até 30 dias úteis após instrução completa", etapas: "Recepção; análise técnica; complementação, quando necessária; decisão fundamentada.", prioridades: "Prioridades legais de atendimento", espera: "Até 20 minutos no atendimento presencial", manifestacao: "Ouvidoria e acompanhamento digital do atendimento", vocabulario: "reforma, planta, alvará, construção, acessibilidade" } }],
    ["diario", "diario", { title: "Aurora das Veredas — edição de atos administrativos", body: "Organização de atos administrativos e comunicados do Município de Aurora das Veredas.", values: { tipo: "Ordinária", data: "2026-11-11", caderno: "Administração municipal", secao: "Atos administrativos" } }],
    ["camada", "camadas", { title: "Aurora das Veredas — equipamentos culturais e zona central", body: "Localização do centro cultural e perímetro de referência da Zona Central de Aurora das Veredas.", values: { tipo: "Zoneamento", legislacao: "Aurora das Veredas — Lei 128/2026", vigencia: "2026-01-01", publicar: "Sim" }, geometry: { type: "FeatureCollection", features: [{ type: "Feature", properties: { nome: "Centro Cultural das Veredas", endereco: "Praça das Veredas, 80", uso: "Cultural" }, geometry: { type: "Point", coordinates: [-43.9503, -18.5004] } }, { type: "Feature", properties: { nome: "Zona Central de Aurora das Veredas", ocupacaoMaxima: 60, permeabilidadeMinima: 20 }, geometry: { type: "Polygon", coordinates: [[[-43.954, -18.504], [-43.946, -18.504], [-43.946, -18.496], [-43.954, -18.496], [-43.954, -18.504]]] } }] } }],
  ];
  for (const [slug, family, input] of additional) {
    const r = await record(slug, family, input);
    if (["carta", "camadas", "delegacoes"].includes(family)) await command(`${slug}-ativo`, r.id, "ATIVAR");
    else if (!["procuracoes", "diario"].includes(family)) await command(`${slug}-protocolado`, r.id, "PROTOCOLAR");
  }
  await upload("ged-original", records.ged.id, attachment, "memorial-centro-cultural.pdf", "Memorial");
  await once("sector-tags", async () => api(`/api/modules/records/${records.ged.id}/completion`, bearer, "POST", { revision: (await read(records.ged.id)).revision, action: "TAGS", payload: { departmentId: sectors.administracao.id, labels: ["Equipamento cultural", "Análise prioritária"] }, note: "Classificação setorial do memorial do centro cultural." }));
  await command("ged-concluido", records.ged.id, "CONCLUIR", {}, "Memorial revisado e disponibilizado para instrução do projeto.");
  await command("ged-assinatura", records.ged.id, "SOLICITAR_ASSINATURA", { signers: [{ userId: staff.helena.id, order: 1 }, { userId: staff.marcos.id, order: 2 }] });
  await command("parecer-concluido", records.parecer.id, "CONCLUIR", {}, "Análise técnica concluída com condicionantes documentadas.");
  await command("atos-concluidos", records.atos.id, "CONCLUIR", {}, "Redação do ato revisada e encaminhada para organização da edição.");
  await command("diario-preparado", records.diario.id, "PREPARAR_EDICAO", { actIds: [records.atos.id] });
  const notebook = await once("diary-notebook", () => api("/api/modules/diary-catalog", bearer, "PUT", { parentId: null, kind: "CADERNO", name: "Aurora das Veredas — Administração municipal", position: 10, active: true, revision: 0, note: "Organização dos atos administrativos municipais." }));
  const section = await once("diary-section", () => api("/api/modules/diary-catalog", bearer, "PUT", { parentId: notebook.id, kind: "SECAO", name: "Atos administrativos", position: 10, active: true, revision: 0, note: "Classificação das portarias e demais atos administrativos." }));
  await once("diary-organized", async () => api(`/api/modules/diary-catalog/editions/${records.diario.id}`, bearer, "PUT", { revision: (await read(records.diario.id)).revision, note: "Ato classificado no caderno e seção correspondentes.", items: [{ id: records.atos.id, catalogId: section.id, withdrawn: false }] }));
  // Keep the edition awaiting institutional signature, never invent official publication.
  const anonymousSecret = journal.anonymousSecret ??= randomBytes(32).toString("hex"); save();
  const anonymous = await once("anonymous-created", () => api("/api/modules/anonymous", "", "POST", { action: "CREATE", key: anonymousSecret, workflowId: flowMap.ouvidoria.id, title: "Iluminação do caminho de acesso ao centro cultural", body: "Solicita-se verificar os pontos de iluminação no percurso entre a Praça das Veredas e a entrada lateral do centro cultural.", purpose: "Solicitação", values: {} }));
  await once("anonymous-submitted", async () => { const r = await api("/api/modules/anonymous", "", "POST", { action: "READ", key: anonymousSecret }); return api("/api/modules/anonymous", "", "POST", { action: "SUBMIT", key: anonymousSecret, revision: r.revision, operationId: key("anonymous-submit") }); });
  const courses: Row[] = [];
  for (const [slug, title, module, lessons] of [
    ["atendimento", "Gestão documental e atendimento ao cidadão", "Protocolo", [{ title: "Recepção e encaminhamento", videoUrl: "https://www.youtube.com/watch?v=yCotD2zjjQA", content: "Material audiovisual complementar de fundamentos arquivísticos do IFNMG. No atendimento municipal, registre o assunto e os documentos, confira a classificação de acesso e encaminhe ao setor competente. Não equivale a treinamento certificado por instituição externa." }, { title: "Proteção das informações e acompanhamento", videoUrl: "https://www.youtube.com/watch?v=yCotD2zjjQA", content: "Informações pessoais devem ser acessíveis somente aos responsáveis autorizados. Use notas internas para instrução restrita e respostas ao interessado para comunicações liberadas. Acompanhe prazos e registre a conclusão de cada participação." }]],
    ["territorio", "Rotina de análise territorial e preservação de originais", "Urbanismo", [{ title: "Plantas e documentos de origem", videoUrl: "https://www.youtube.com/watch?v=yCotD2zjjQA", content: "Associe o processo à origem documental. Preserve a planta original, confira escala e unidades e salve anotações como cópia derivada. Compare o projeto com a legislação selecionada antes de fundamentar a decisão." }]],
  ] as [string, string, string, Row[]][]) {
    const course = await once(`course:${slug}`, async () => (await api("/api/operations/courses", bearer, "POST", { title, module, passScore: 70, lessons, questions: [{ prompt: "Como preservar um documento original?", options: ["Manter o original e gerar derivado para anotações", "Substituir o original pelo arquivo alterado"], answer: 0 }, { prompt: "Qual deve ser o alcance das informações pessoais?", options: ["Acesso aos responsáveis autorizados", "Publicação sem restrição"], answer: 0 }] })).course); courses.push(course);
  }
  for (let index = 0; index < 2; index++) await once(`course-lesson:${index}`, () => api(`/api/operations/courses/${courses[0].id}`, reader, "POST", { action: "lesson", index }));
  await once("course-assessment", () => api(`/api/operations/courses/${courses[0].id}`, reader, "POST", { action: "assessment", answers: [0, 0] }));
  for (const [slug, subject, message, severity] of [
    ["rede", "Oscilação de conexão no balcão de atendimento", "A conexão do terminal do balcão 2 oscila durante o envio de arquivos. Solicito análise do ponto de rede.", "HIGH"],
    ["orientacao", "Orientação sobre classificação de documentos", "Solicito orientação para associar o memorial do centro cultural ao plano de classificação e preservar os originais.", "NORMAL"],
  ]) {
    const ticket = await once(`ticket:${slug}`, async () => (await api("/api/operations/tickets", reader, "POST", { subject, message, severity })).ticket);
    await once(`ticket-assigned:${slug}`, () => api(`/api/operations/tickets/${ticket.id}`, bearer, "PATCH", { message: "Atendimento recebido pela equipe de gestão documental. Análise iniciada.", assigneeId: staff.helena.id, status: "IN_PROGRESS" }));
    if (slug === "orientacao") { await once("ticket-resolved", () => api(`/api/operations/tickets/${ticket.id}`, bearer, "PATCH", { message: "Orientação prestada: vincular o memorial à série de obras e manutenção, preservando o original e a cópia anotada separadamente.", status: "RESOLVED" })); await once("ticket-rated", () => api(`/api/operations/tickets/${ticket.id}`, reader, "PATCH", { message: "A orientação esclareceu o procedimento de classificação.", rating: 5 })); }
  }
  const { workerTick } = await import("../src/lib/jobs/worker");
  for (const kind of ["PDF", "ZIP", "PDFA", "OCR"]) {
    const job = await once(`job:${kind}`, async () => (await api("/api/jobs", bearer, "POST", { kind, selection: "custom", sources: [{ type: "module", id: records.projetos.id }], fileIds: [plant.id], idempotencyKey: key(`job:${kind}`) })).job);
    await once(`job-run:${kind}`, async () => { await workerTick(job.id); const state = (await api(`/api/jobs/${job.id}`, bearer)).job; assert.equal(state.status, "SUCCEEDED"); return { id: job.id, status: state.status, hash: state.outputHash }; });
  }
  const { reportWorkerOnce } = await import("../src/lib/operations/report-worker");
  const filters = { from: "2026-11-01", to: "2026-11-30", department: sectors.administracao.id };
  for (const format of ["csv", "pdf", "xlsx"]) {
    const job = await once(`report-job:${format}`, () => api("/api/operations/report-jobs", bearer, "POST", { format, filters, requestId: key(`report:${format}`) }));
    await once(`report-run:${format}`, async () => { await reportWorkerOnce(job.id); const [state] = await sql("SELECT status FROM operation_report_job WHERE id=$1", [job.id]); assert.equal(state.status, "READY"); return { id: job.id, status: state.status }; });
  }
  await once("contract-report", () => api("/api/operations/contract-reports", bearer, "POST", { period: "2026-11", requestKey: `aurora-novembro-2026-${key("contract-report")}` }));
  const counts = await sql("SELECT family,count(*)::int AS count FROM module_record WHERE owner_id=$1 GROUP BY family", [staff.helena.id]);
  assert.ok(Object.keys(families).every(family => counts.some(row => row.family === family && row.count > 0)), "Cobertura das 27 famílias");
  const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(base + "/admin"); await page.getByLabel("E-mail", { exact: true }).fill(journal.credentials.helena.email); await page.getByLabel("Senha", { exact: true }).fill(journal.credentials.helena.password); await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.getByRole("heading", { name: "Servidores e permissões", exact: true }).waitFor({ timeout: 60000 });
    for (const family of Object.keys(families)) {
      await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname === `/api/modules/${family}` && response.status() === 200, { timeout: 60000 }), page.goto(base + `/gestao/${family}`)]);
      await page.getByRole("heading", { name: families[family as Family], exact: true }).waitFor({ timeout: 30000 });
      const [example] = await sql("SELECT code FROM module_record WHERE owner_id=$1 AND family=$2 ORDER BY created_at DESC,id DESC LIMIT 1", [staff.helena.id, family]);
      assert.ok(example); await page.getByText(example.code, { exact: true }).first().waitFor({ timeout: 30000 });
    }
    await page.goto(base + "/gestao/geoportal"); await page.getByRole("button", { name: "Centro Cultural das Veredas", exact: true }).waitFor({ timeout: 30000 }); await page.screenshot({ path: join(directory, "geoportal.png") });
    await page.goto(base + `/gestao/registros/${records.projetos.id}`); await page.getByRole("heading", { name: records.projetos.title, exact: true }).waitFor(); await page.screenshot({ path: join(directory, "project.png") });
  } catch (error) {
    for (const context of browser.contexts()) for (const page of context.pages()) { await page.screenshot({ path: join(directory, "browser-failure.private.png"), fullPage: true }).catch(() => {}); writeFileSync(join(directory, "browser-failure.private.txt"), await page.locator("body").innerText().catch(() => "Unavailable"), { mode: 0o600 }); }
    throw error;
  } finally { await browser.close(); }
  const summary = { at: new Date().toISOString(), complete: true, municipality: journal.municipality, moduleFamilies: counts.length, counts, documents: { memorandum: memorandum.id, circular: circular.id }, anonymousCode: anonymous.code, principalAccount: journal.credentials.helena.email, directory, resources: Object.keys(journal.resources).length, limitations: ["Fictional municipality, people, legislation and cases; mathematical tax ID validity is not civil identity verification.", "No genuine e-mail delivery, Gov.br session, certified signature, Sisobra receipt or certified diary publication was fabricated.", "External verified-email onboarding and electronic mandates still require a controlled mailbox and explicit consent by the account holder.", "Training progress belongs to an operational example account, not evidence of actual municipal staff qualification.", "Job downloads expire according to retention; regenerate by the UI and an active executor when necessary."] };
  writeFileSync(join(directory, "summary.json"), JSON.stringify(summary, null, 2), { mode: 0o600 }); journal.complete = true; save();
  console.log(JSON.stringify({ directory, complete: true, families: counts.length, resources: summary.resources, accessFile: join(directory, "access.private.json") }));
}
void main().catch(error => {
  const index = process.argv.indexOf("--directory"), directory = index >= 0 ? resolve(process.argv[index + 1]) : "";
  const root = resolve(process.env.LOCALAPPDATA!, "Temp/opencode");
  if (directory.startsWith(root + "\\") || directory.startsWith(root + "/")) { mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, "failure-final.private.txt"), String(error?.stack ?? error), { mode: 0o600 }); }
  console.error("Preparação interrompida; confira o manifesto e o diagnóstico privados antes de retomar. Recursos já criados foram preservados."); process.exitCode = 1;
});
