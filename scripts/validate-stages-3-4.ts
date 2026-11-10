/** Explicit opt-in integration/browser acceptance, with owned-resource cleanup. */
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { chromium, type Page } from "playwright-core";
import { firebaseAdminAuth } from "../src/lib/firebase-admin";

type Row = Record<string, any>;
const args = process.argv.slice(2), option = (flag: string) => args[args.indexOf(flag) + 1];
const base = option("--base"), directory = resolve(option("--directory"));
const root = resolve(process.env.LOCALAPPDATA!, "Temp/opencode");
assert.ok(directory.startsWith(root + "\\") && args.includes("--allow-write"));
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) || args.includes("--allow-production") && base === "https://rioazul.celeriflow.com.br");
const sql = neon(process.env.DATABASE_URL!), auth = firebaseAdminAuth();
const hash = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");
const manifest = join(directory, "manifest.private.json");
const extraPath = join(directory, "stages34.private.json");
const journal: Row = args.includes("--cleanup") ? JSON.parse(readFileSync(manifest, "utf8")) : { database: hash(process.env.DATABASE_URL!), users: [], sectors: [], documents: [], blobs: [], citizens: [] };
const extra: Row = args.includes("--cleanup") ? JSON.parse(readFileSync(extraPath, "utf8")) : { profiles: [], contacts: [], external: [] };
assert.equal(journal.database, hash(process.env.DATABASE_URL!));
const results: Row[] = [];
function save() { writeFileSync(manifest, JSON.stringify(journal, null, 2), { mode: 0o600 }); writeFileSync(extraPath, JSON.stringify(extra, null, 2), { mode: 0o600 }); }
function check(assertion: string, condition: unknown) { results.push({ assertion, outcome: condition ? "PASS" : "FAIL" }); writeFileSync(join(directory, "results.json"), JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2)); assert.ok(condition, assertion); }
async function token(uid: string) {
  const custom = await auth.createCustomToken(uid);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }), signal: AbortSignal.timeout(30000) });
  const value = await response.json(); assert.ok(value.idToken); return String(value.idToken);
}
async function request(path: string, bearer = "", method = "GET", data?: unknown, expected = 200): Promise<Row> {
  const response = await fetch(base + path, { method, headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), "content-type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(60000) });
  const value = await response.json();
  if (method === "POST" && value.id) {
    if (path === "/api/admin/departments") journal.sectors.push(value.id);
    if (path === "/api/admin/users") journal.users.push({ id: value.id, uid: value.firebaseUid });
    if (path === "/api/circulars") journal.documents.push(value.id);
    if (path === "/api/modules/contatos/perfis") extra.profiles.push(value.id);
    if (path === "/api/cidadao/conta/cadastro" && !extra.contacts.includes(value.id)) extra.contacts.push(value.id);
    save();
  }
  if (method === "POST" && path === "/api/cidadao/requerimentos" && value.publicKey) {
    const [doc] = await sql("SELECT id FROM document WHERE public_key=$1", [value.publicKey]); assert.ok(doc);
    journal.documents.push(doc.id); save();
  }
  check(`${method} ${path.replace(/[a-f0-9-]{36}/gi, "<id>").replace(/[A-Za-z0-9_-]{32}/g, "<key>")} => ${expected}`, response.status === expected);
  return value;
}
function fiscal(length = 9) {
  const n = Array.from(randomBytes(length), b => b % 10);
  if (length === 9) for (const size of [9, 10]) n.push((n.reduce((sum, v, i) => sum + v * (size + 1 - i), 0) * 10 % 11) % 10);
  else for (const weights of [[5,4,3,2,9,8,7,6,5,4,3,2], [6,5,4,3,2,9,8,7,6,5,4,3,2]]) { const remainder = n.reduce((sum, v, i) => sum + v * weights[i], 0) % 11; n.push(remainder < 2 ? 0 : 11 - remainder); }
  return n.join("");
}
async function upload(path: string, bearer: string, text: string, filename: string) {
  const form = new FormData(); form.set("file", new File([text], filename, { type: "text/plain" }));
  const response = await fetch(base + path, { method: "POST", headers: { authorization: `Bearer ${bearer}` }, body: form });
  const value = await response.json();
  if (value.id) { const [file] = await sql("SELECT storage_key FROM attachment WHERE id=$1", [value.id]); journal.blobs.push(file.storage_key); save(); }
  check("private upload => 201", response.status === 201); return value;
}
async function login(page: Page, person: Row, external = false) {
  await page.goto(base + (external ? "/cidadao/conta" : "/admin"));
  await page.getByLabel("E-mail", { exact: true }).fill(person.email); await page.getByLabel("Senha", { exact: true }).fill(person.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("heading", { name: external ? "Meus protocolos" : "Servidores e permissões", exact: true }).waitFor({ timeout: 60000 });
}
async function execute() {
  const [admin] = await sql("SELECT u.id,u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND r.name='ADMIN_GERAL' AND u.firebase_uid IS NOT NULL ORDER BY u.id LIMIT 1");
  const administrator = await token(admin.firebase_uid);
  const sectors: string[] = [];
  for (const [i, name] of ["Administração", "Atendimento", "Análise", "Planejamento"].entries()) {
    const d = await request("/api/admin/departments", administrator, "POST", { name: `Aurora das Veredas — ${name}`, acronym: randomBytes(4).toString("hex"), ...(i === 1 || i === 2 ? { parentId: sectors[0] } : {}) }, 201); sectors.push(d.id);
  }
  const [a, b, c, outside] = sectors;
  const staff: Row[] = [];
  for (const [i, name] of ["Helena Duarte", "Rafael Nogueira", "Clara Ribeiro", "Marcos Azevedo", "Laura Antunes"].entries()) {
    const email = `servidor.${randomUUID()}@aurora.mg.gov.br`, password = randomBytes(24).toString("base64url");
    const person = await request("/api/admin/users", administrator, "POST", { name, email, password, departmentId: [a,b,c,outside,a][i], role: i === 4 ? "NIVEL_3_VISUALIZACAO" : "ADMIN_GERAL" }, 201);
    staff.push({ ...person, email, password, token: await token(person.firebaseUid) });
  }
  const [sender, recipient, other, stranger, observer] = staff;
  const circularBody = { subject: "Organização do atendimento municipal", body: "<p>Comunicado aos servidores dos subsetores.</p>", originDepartmentId: a, departmentIds: [b, c], urgency: "URGENT", circularReplyMode: "RESTRICTED" };
  const restricted = await request("/api/circulars", sender.token, "POST", circularBody, 201);
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => request(`/api/circulars/${restricted.id}/read`, recipient.token, "POST", {})));
  check("concurrent receipts preserve identical first timestamp", concurrent.every(r => r.firstReadAt === concurrent[0].firstReadAt));
  check("one receipt per user under concurrency", (await sql("SELECT count(*)::int AS n FROM document_read_receipt WHERE document_id=$1 AND user_id=$2", [restricted.id, recipient.id]))[0].n === 1);
  await assert.rejects(() => sql("UPDATE document_read_receipt SET first_read_at=now()+interval '1 day' WHERE document_id=$1 AND user_id=$2", [restricted.id, recipient.id]));
  check("database rejects first-read timestamp mutation", true);
  await request(`/api/circulars/${restricted.id}`, other.token);
  const detail = await request(`/api/circulars/${restricted.id}`, sender.token);
  const listed = await request(`/api/circulars?q=${restricted.displayNumber}`, sender.token);
  check("list and detail count the same two individual recipients", detail.stats.total === 2 && detail.stats.read === 2 && JSON.stringify(detail.stats) === JSON.stringify({ total: listed.circulars[0].total, read: listed.circulars[0].read, unread: listed.circulars[0].unread }));
  check("sender access does not produce recipient receipt", !detail.myReceipt && (await sql("SELECT count(*)::int AS n FROM document_read_receipt WHERE document_id=$1", [restricted.id]))[0].n === 2);
  check("unread list filter agrees with complete receipts", (await request(`/api/circulars?q=${restricted.displayNumber}&unread=1`, sender.token)).total === 0 && (await request(`/api/circulars/${restricted.id}?unread=1`, sender.token)).recipients.length === 0);
  await request(`/api/circulars/${restricted.id}/read`, observer.token, "POST", {}, 403);
  await request(`/api/circulars/${restricted.id}`, stranger.token, "GET", undefined, 404);
  await request(`/api/circulars/${restricted.id}/read`, stranger.token, "POST", {}, 404);
  await request(`/api/documents/${restricted.id}/receive`, recipient.token, "POST", { departmentId: b });
  await request(`/api/documents/${restricted.id}/actions?action=reply`, recipient.token, "POST", { departmentId: b, note: "Resposta reservada sobre a organização do atendimento." });
  const recipientReply = await request(`/api/documents/${restricted.id}`, recipient.token);
  const senderReply = await request(`/api/documents/${restricted.id}`, sender.token);
  const otherReply = await request(`/api/documents/${restricted.id}`, other.token);
  const circularOther = await request(`/api/circulars/${restricted.id}`, other.token);
  check("restricted reply available to sender and own author", senderReply.timeline.some((e: Row) => e.action === "CIRCULAR_REPLY") && recipientReply.timeline.some((e: Row) => e.action === "CIRCULAR_REPLY"));
  check("restricted reply absent from both detail APIs for other recipients", !JSON.stringify(otherReply).includes("Resposta reservada") && !JSON.stringify(circularOther).includes("Resposta reservada"));
  const open = await request("/api/circulars", sender.token, "POST", { ...circularBody, circularReplyMode: "OPEN" }, 201);
  await request(`/api/documents/${open.id}/receive`, recipient.token, "POST", { departmentId: b });
  await request(`/api/documents/${open.id}/actions?action=reply`, recipient.token, "POST", { departmentId: b, note: "Resposta aberta aos envolvidos." });
  check("open replies are visible to another involved recipient", JSON.stringify(await request(`/api/documents/${open.id}`, other.token)).includes("Resposta aberta aos envolvidos."));
  await request(`/api/circulars/${restricted.id}/recipients`, sender.token, "PATCH", { departmentIds: [c] });
  await request(`/api/circulars/${restricted.id}`, recipient.token, "GET", undefined, 404);
  await request(`/api/documents/${restricted.id}/actions?action=reply`, recipient.token, "POST", { departmentId: b, note: "Acesso removido" }, 404);
  const removed = await request(`/api/circulars/${restricted.id}`, sender.token);
  check("removed recipients are excluded from counts with receipts retained", removed.stats.total === 1 && removed.stats.read === 1 && (await sql("SELECT count(*)::int AS n FROM document_read_receipt WHERE document_id=$1", [restricted.id]))[0].n === 2);
  await request(`/api/circulars/${restricted.id}/recipients`, sender.token, "PATCH", { departmentIds: [b,c] });
  const restored = await request(`/api/circulars/${restricted.id}`, recipient.token);
  check("re-added recipient retains first receipt", new Date(restored.myReceipt.firstReadAt).getTime() === new Date(concurrent[0].firstReadAt).getTime());
  await request(`/api/admin/users/${recipient.id}`, administrator, "PATCH", { departmentId: c });
  await request(`/api/circulars/${restricted.id}`, recipient.token, "GET", undefined, 404);
  await request(`/api/circulars/${restricted.id}/recipients`, sender.token, "PATCH", { departmentIds: [b,c] });
  const transferred = await request(`/api/circulars/${restricted.id}`, recipient.token);
  check("recipient edit refreshes transferred membership without resetting receipt", transferred.recipients.find((r: Row) => r.userId === recipient.id).sector === (await sql("SELECT acronym FROM department WHERE id=$1", [c]))[0].acronym && new Date(transferred.myReceipt.firstReadAt).getTime() === new Date(concurrent[0].firstReadAt).getTime());
  await request(`/api/admin/users/${recipient.id}`, administrator, "PATCH", { departmentId: b });
  await request(`/api/circulars/${restricted.id}/recipients`, sender.token, "PATCH", { departmentIds: [b,c] });
  const informative = await request("/api/circulars", sender.token, "POST", { ...circularBody, urgency: "INFORMATIVE", departmentIds: [a], includeSubdepartments: true }, 201);
  await request(`/api/documents/${informative.id}/receive`, recipient.token, "POST", { departmentId: b });
  await request(`/api/documents/${informative.id}/actions?action=reply`, recipient.token, "POST", { departmentId: b, note: "Não permitido" }, 409);
  await request(`/api/documents/${informative.id}/forward`, recipient.token, "POST", { departmentId: b, toDepartmentId: outside }, 409);
  const informational = await request(`/api/circulars/${informative.id}`, sender.token);
  check("organogram descendant selection resolves individual users once", informational.stats.total === 4);
  const circularFile = await upload(`/api/documents/${informative.id}/attachments`, sender.token, "Informações aos servidores.", "comunicado.txt");
  await request(`/api/documents/${informative.id}/deadlines`, sender.token, "POST", { title: "Ciência do comunicado", dueAt: "2030-01-20T15:00:00.000Z" }, 201);
  await request(`/api/documents/${informative.id}/actions?action=conclude`, recipient.token, "POST", { departmentId: b });
  await request(`/api/documents/${informative.id}/actions?action=archive`, recipient.token, "POST", { departmentId: b });
  check("circular sector archives while other recipients remain active", (await request(`/api/documents/${informative.id}`, sender.token)).participation.find((p: Row) => p.departmentId === b).state === "ARCHIVED");

  // Isolated contact profile; original municipal configurations are never changed.
  const profile = await request("/api/modules/contatos/perfis", sender.token, "POST", { name: "Atendimento de Aurora das Veredas", active: true, definition: { types: ["Pessoa física", "Pessoa jurídica"], base: [{ key: "cpfCnpj", enabled: true, required: true }, { key: "email", enabled: true, required: true }], fields: [] } }, 201);
  const citizens: Row[] = [];
  for (let i = 0; i < 3; i++) {
    const uid = `stages34-${randomUUID()}`, email = `cidadao.${randomUUID()}@aurora.mg.gov.br`, password = randomBytes(24).toString("base64url");
    extra.external.push(uid); save();
    await auth.createUser({ uid, email, password, displayName: ["Renata Alencar", "Associação Veredas", "Otávio Gomes"][i], emailVerified: i !== 2 });
    citizens.push({ uid, email, password, token: await token(uid), fiscal: fiscal(i === 1 ? 12 : 9) });
  }
  const [owner, company, unverified] = citizens;
  const registration = { name: "Renata Alencar", profileId: profile.id, profileRevision: 1, revision: 0, values: { tipo: "Pessoa física", cpfCnpj: owner.fiscal, email: owner.email }, address: { street: "Rua das Palmeiras", number: "120", district: "Centro", city: "Aurora das Veredas", state: "MG" } };
  await request("/api/cidadao/conta/cadastro", "", "POST", registration, 401);
  await request("/api/cidadao/conta/cadastro", unverified.token, "POST", registration, 401);
  await request("/api/cidadao/conta/cadastro", owner.token, "POST", { ...registration, values: { ...registration.values, cpfCnpj: "11111111111" } }, 400);
  await request("/api/cidadao/conta/cadastro", owner.token, "POST", registration);
  const [account] = await sql("SELECT citizen_id FROM module_contact_account WHERE uid=$1", [owner.uid]); journal.citizens.push(account.citizen_id); save();
  let citizenDetail = await request("/api/cidadao/conta/cadastro", owner.token);
  await request("/api/cidadao/conta/cadastro", owner.token, "POST", { ...registration, revision: citizenDetail.revision, values: { ...registration.values, phone: "31988887777" } });
  citizenDetail = await request("/api/cidadao/conta/cadastro", owner.token);
  await request("/api/cidadao/conta/cadastro", owner.token, "POST", { ...registration, revision: citizenDetail.revision - 1 }, 409);
  await request("/api/cidadao/conta/cadastro", company.token, "POST", { ...registration, values: { ...registration.values, email: company.email } }, 409);
  await request("/api/cidadao/conta/cadastro", company.token, "POST", { ...registration, name: "Associação Veredas", values: { tipo: "Pessoa jurídica", cpfCnpj: company.fiscal, email: company.email } });
  journal.citizens.push((await sql("SELECT citizen_id FROM module_contact_account WHERE uid=$1", [company.uid]))[0].citizen_id); save();
  check("two registrations without duplicate fiscal identities", (await sql("SELECT count(*)::int AS n FROM citizen WHERE id=ANY($1::uuid[])", [journal.citizens]))[0].n === 2);
  await request("/api/cep?cep=1", "", "GET", undefined, 400);
  await request("/api/cep?cep=00000000", "", "GET", undefined, 404);
  const cep = await request("/api/cep?cep=30130010"); check("real ViaCEP returns confirmed Belo Horizonte address", cep.city === "Belo Horizonte" && cep.state === "MG" && !!cep.street);
  const requestBody = { name: registration.name, cpfCnpj: owner.fiscal, email: owner.email, phone: "31988887777", cep: "30130010", street: "Rua das Palmeiras", number: "120", district: "Centro", city: "Aurora das Veredas", state: "MG", requestType: "Solicitação de serviço", description: `Solicito melhoria do atendimento. Contato reservado: ${owner.email} ${owner.fiscal}` };
  await request("/api/cidadao/requerimentos", "invalid-token", "POST", requestBody, 401);
  const protocol = await request("/api/cidadao/requerimentos", owner.token, "POST", requestBody, 201);
  const companyProtocol = await request("/api/cidadao/requerimentos", company.token, "POST", { ...requestBody, name: "Associação Veredas", cpfCnpj: company.fiscal, email: company.email }, 201);
  const [doc] = await sql("SELECT id,origin_department_id FROM document WHERE public_key=$1", [protocol.publicKey]);
  const intake = doc.origin_department_id;
  await request(`/api/admin/users/${sender.id}`, administrator, "PATCH", { secondaryDepartmentIds: [intake] });
  const inbox = await request(`/api/documents?q=${protocol.protocolNumber}`, sender.token);
  check("protocol discoverable by business number in responsible internal inbox", inbox.documents.some((d: Row) => d.id === doc.id) && (await sql("SELECT state FROM document_participation WHERE document_id=$1 AND department_id=$2", [doc.id, intake]))[0].state === "PENDING");
  await request(`/api/documents/${doc.id}/receive`, sender.token, "POST", { departmentId: intake });
  await request(`/api/documents/${doc.id}/assignment`, sender.token, "PATCH", { assigneeId: sender.id, departmentId: intake });
  await request(`/api/documents/${doc.id}/assignment`, sender.token, "PATCH", { assigneeId: stranger.id, departmentId: intake }, 409);
  const assigned = await request(`/api/documents/${doc.id}`, sender.token);
  check("request subject, assignee and assignment history persisted", assigned.document.assigneeId === sender.id && assigned.document.subject === requestBody.requestType && assigned.timeline.some((m: Row) => m.action === "ASSIGNEE_UPDATED"));
  await request(`/api/documents/${doc.id}/actions?action=reply`, sender.token, "POST", { departmentId: intake, note: "Nota interna reservada com identificação do servidor.", visibility: "INTERNAL" });
  await request(`/api/documents/${doc.id}/actions?action=reply`, sender.token, "POST", { departmentId: intake, note: "Sua solicitação foi recebida e está em análise.", visibility: "CITIZEN" });
  const ownFile = await upload(`/api/cidadao/requerimentos/${protocol.publicKey}/attachments`, owner.token, "Complemento do cidadão.", "complemento.txt");
  const privateFile = await upload(`/api/documents/${doc.id}/attachments`, sender.token, "Informações internas.", "analise-interna.txt");
  await request(`/api/cidadao/requerimentos/${protocol.publicKey}/attachments/${privateFile.id}`, owner.token, "GET", undefined, 404);
  await request(`/api/attachments/${privateFile.id}`, "", "GET", undefined, 401);
  await request(`/api/attachments/${privateFile.id}`, sender.token, "PATCH", { citizenVisible: true });
  const granted = await fetch(`${base}/api/cidadao/requerimentos/${protocol.publicKey}/attachments/${privateFile.id}`, { headers: { authorization: `Bearer ${owner.token}` } });
  check("explicit released attachment has original bytes", granted.status === 200 && await granted.text() === "Informações internas.");
  await request(`/api/attachments/${privateFile.id}`, sender.token, "PATCH", { citizenVisible: false });
  await request(`/api/cidadao/requerimentos/${protocol.publicKey}/attachments/${privateFile.id}`, owner.token, "GET", undefined, 404);
  await request(`/api/cidadao/requerimentos/${protocol.publicKey}`, owner.token, "POST", { text: "Acrescento informações para o atendimento municipal." }, 201);
  const personal = await request(`/api/cidadao/requerimentos/${protocol.publicKey}`, owner.token);
  check("owner sees authorized reply and complement, without internal note/file/history", JSON.stringify(personal).includes("Sua solicitação foi recebida") && JSON.stringify(personal).includes("Acrescento informações") && !JSON.stringify(personal).includes("Nota interna reservada") && !JSON.stringify(personal).includes("ASSIGNEE_UPDATED") && personal.attachments.length === 1);
  await request(`/api/cidadao/requerimentos/${protocol.publicKey}`, company.token, "GET", undefined, 404);
  await request(`/api/cidadao/requerimentos/${protocol.publicKey}/attachments/${ownFile.id}`, company.token, "GET", undefined, 404);
  const publicData = await request(`/api/publico/${protocol.publicKey}`);
  const publicCitizen = await request(`/api/cidadao/requerimentos?key=${protocol.publicKey}`);
  check("both public channels share the same safe DTO", JSON.stringify(publicData) === JSON.stringify(publicCitizen));
  check("public projection excludes identifiers, notes, body, files, responsible and UUID", ![owner.email, owner.fiscal, doc.id, "Nota interna", "analise-interna", "Sua solicitação", "ASSIGNEE_UPDATED"].some(secret => JSON.stringify(publicData).includes(secret)) && !publicData.body && !publicData.attachments);
  const companyPublic = await request(`/api/publico/${companyProtocol.publicKey}`);
  check("CNPJ public mask preserves correct length and conceals digits", /^\*\*\.\*\*\*\.\d{3}\/\d{4}-\*\*$/.test(companyPublic.citizen.cpfCnpj) && !JSON.stringify(companyPublic).includes(company.fiscal));
  const pendingMessages = await sql("SELECT status,sent_at,provider_message_id FROM email_message WHERE document_id=$1", [doc.id]);
  check("receipt and citizen reply notifications queued without fake delivery", protocol.emailStatus === "PENDING" && protocol.notificationStatus === "AWAITING_CHANNEL_CONFIGURATION" && pendingMessages.length === 2 && pendingMessages.every(m => m.status === "PENDING" && !m.sent_at && !m.provider_message_id));
  check("complement and assignment generate internal notification events", (await sql("SELECT action FROM audit_log WHERE entity_id=$1 AND action IN('CITIZEN_COMPLEMENT','REQUEST_ASSIGNED')", [doc.id])).length === 2);
  for (const classification of ["INTERNAL", "CONFIDENTIAL"]) {
    await sql("UPDATE document SET access_level=$2 WHERE id=$1", [doc.id, classification]);
    await request(`/api/publico/${protocol.publicKey}`, "", "GET", undefined, 404);
    await request(`/api/cidadao/requerimentos?key=${protocol.publicKey}`, "", "GET", undefined, 404);
    await request(`/api/cidadao/requerimentos/${protocol.publicKey}`, owner.token, "GET", undefined, classification === "INTERNAL" ? 200 : 404);
    if (classification === "CONFIDENTIAL") {
      await request(`/api/cidadao/requerimentos/${protocol.publicKey}/attachments/${ownFile.id}`, owner.token, "GET", undefined, 404);
      await request(`/api/cidadao/requerimentos/${protocol.publicKey}`, owner.token, "POST", { text: "Não pode ser adicionado." }, 404);
      check("confidential request also excluded from personal inbox", !(await request("/api/cidadao/conta", owner.token)).requests.some((r: Row) => r.publicKey === protocol.publicKey));
    }
  }
  await sql("UPDATE document SET access_level='PUBLIC' WHERE id=$1", [doc.id]);
  await request(`/api/documents/${doc.id}/actions?action=conclude`, sender.token, "POST", { departmentId: intake });
  await request(`/api/cidadao/requerimentos/${protocol.publicKey}`, owner.token, "POST", { text: "Complemento após encerramento." }, 409);
  await request(`/api/documents/${doc.id}/actions?action=reopen`, sender.token, "POST", { departmentId: intake });

  const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); await login(page, sender);
    await page.goto(`${base}/circulares/nova`); await page.getByRole("heading", { name: "Nova circular", exact: true }).waitFor();
    await page.getByLabel("Origem", { exact: false }).selectOption(a);
    await page.getByLabel("Assunto", { exact: true }).fill("Circular de atendimento redigida pela interface");
    await page.getByRole("textbox", { name: "Conteúdo do documento", exact: true }).fill("Comunicação municipal aos subsetores de atendimento e análise.");
    await page.getByLabel("Respostas", { exact: false }).selectOption("RESTRICTED");
    await page.getByLabel("Aurora das Veredas — Atendimento", { exact: true }).check(); await page.getByLabel("Aurora das Veredas — Análise", { exact: true }).check();
    const createdResponse = page.waitForResponse(r => r.url() === base + "/api/circulars" && r.request().method() === "POST");
    await page.getByRole("button", { name: "Enviar para 2 setor(es)", exact: true }).click();
    const created = await (await createdResponse).json(); if (created.id) { journal.documents.push(created.id); save(); }
    await page.getByRole("heading", { name: new RegExp(created.displayNumber) }).waitFor(); check("circular created through organogram and rich text in Chrome", !!created.id);
    await page.getByRole("button", { name: "Alterar destinatários", exact: true }).click(); await page.getByRole("heading", { name: "Destinatários da circular", exact: true }).waitFor();
    await page.getByLabel("Aurora das Veredas — Atendimento", { exact: true }).uncheck(); await page.getByRole("button", { name: "Salvar destinatários", exact: true }).click();
    await page.getByRole("heading", { name: new RegExp(created.displayNumber) }).waitFor();
    check("recipient changes are navigable and persisted from screen", (await request(`/api/circulars/${created.id}`, sender.token)).stats.total === 1);
    await page.getByRole("button", { name: "Consultar destinatários e recibos", exact: true }).click(); await page.getByRole("cell", { name: "Clara Ribeiro", exact: true }).waitFor();
    check("recipient table renders fixed desktop page without overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight));
    await page.screenshot({ path: join(directory, "circular-recipients.png") });
    await page.goto(`${base}/documentos/${doc.id}`); await page.getByRole("heading", { name: new RegExp(protocol.protocolNumber) }).waitFor();
    await page.getByLabel("Atribuir responsável", { exact: false }).selectOption(sender.id);
    check("internal request screen exposes subject, responsible and differentiated reply", await page.getByText("Atendimento ao cidadão", { exact: true }).count() === 1 && await page.getByRole("option", { name: "Resposta ao cidadão", exact: true }).count() === 1);
    const external = await browser.newPage({ viewport: { width: 1366, height: 768 } }); await login(external, owner, true);
    await external.goto(`${base}/cidadao/conta/cadastro`); await external.getByRole("heading", { name: "Meu cadastro por perfil", exact: true }).waitFor();
    await external.getByLabel("CEP", { exact: true }).fill("30130-010");
    await external.route("**/api/cep?*", route => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "viacep indisponível" }) }));
    await external.getByRole("button", { name: "Buscar endereço pelo CEP", exact: true }).click();
    await external.getByText("Endereço não localizado; preencha manualmente.", { exact: true }).waitFor();
    check("CEP upstream failure is visible and permits manual correction", await external.getByLabel("Endereço", { exact: true }).isEditable());
    await external.unroute("**/api/cep?*"); await external.getByRole("button", { name: "Buscar endereço pelo CEP", exact: true }).click();
    await external.getByText("Endereço localizado. Confira e acrescente número e complemento.", { exact: true }).waitFor();
    check("real CEP address is visible for citizen confirmation", (await external.getByLabel("Endereço", { exact: true }).inputValue()).includes("Belo Horizonte"));
    await external.getByLabel("Endereço", { exact: true }).fill((await external.getByLabel("Endereço", { exact: true }).inputValue()) + ", 120, sala 2");
    await external.getByRole("button", { name: "Salvar cadastro", exact: true }).click(); await external.getByText("Cadastro salvo e vinculado à sua conta.", { exact: true }).waitFor();
    await external.goto(`${base}/cidadao`); await external.getByText("Titular do requerimento: Renata Alencar.", { exact: true }).waitFor();
    await external.getByLabel("Descrição", { exact: true }).fill("Solicito informações sobre o funcionamento do atendimento municipal.");
    const citizenCreation = external.waitForResponse(r => r.url() === base + "/api/cidadao/requerimentos" && r.request().method() === "POST");
    await external.getByRole("button", { name: /Protocolar|Enviar requerimento|Registrar requerimento/ }).click();
    const citizenResponse = await citizenCreation; const citizenResult = await citizenResponse.json();
    if (citizenResult.publicKey) { const [createdDoc] = await sql("SELECT id FROM document WHERE public_key=$1", [citizenResult.publicKey]); journal.documents.push(createdDoc.id); save(); }
    check("citizen opens protocol through authenticated form", citizenResponse.status() === 201);
    await external.getByRole("heading", { name: "Requerimento registrado", exact: true }).waitFor();
    await external.goto(`${base}/cidadao/processos/${protocol.publicKey}`); await external.getByRole("heading", { name: new RegExp(protocol.protocolNumber) }).waitFor();
    check("citizen browser opens own authorized process", await external.getByText("Sua solicitação foi recebida e está em análise.", { exact: true }).count() === 1);
    await external.getByRole("button", { name: "Anexos", exact: true }).click();
    const downloaded = external.waitForEvent("download"); await external.getByRole("button", { name: "Baixar", exact: true }).click();
    const file = await downloaded; const target = join(directory, "citizen-download.private.txt"); await file.saveAs(target);
    check("citizen attachment downloads on authenticated browser click", readFileSync(target, "utf8") === "Complemento do cidadão.");
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(`${base}/publico/${protocol.publicKey}`); await mobile.getByRole("heading", { name: "Consulta pública", exact: true }).waitFor();
    const qr = mobile.getByRole("img", { name: /QR/ }); await qr.waitFor();
    check("public QR page opens at correct mobile URL with no internal content", (await mobile.locator("body").innerText()).includes(protocol.protocolNumber) && !(await mobile.locator("body").innerText()).includes(owner.email));
    await mobile.screenshot({ path: join(directory, "public-mobile.png"), fullPage: true });
    const html = await (await fetch(`${base}/publico/${protocol.publicKey}`)).text();
    const publicOrigin = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || base).replace(/\/$/, "");
    check("QR page encodes configured origin and uses canonical HTTPS in production", (!base.startsWith("https:") || html.includes(`https://rioazul.celeriflow.com.br/publico/${protocol.publicKey}`)) && (base.startsWith("https:") || html.includes(`${publicOrigin}/publico/${protocol.publicKey}`)) && html.includes("data:image/png;base64"));
  } catch (error) {
    for (const [index, context] of browser.contexts().entries()) for (const [p, page] of context.pages().entries()) {
      await page.screenshot({ path: join(directory, `failure-browser-${index}-${p}.png`), fullPage: true }).catch(() => {});
      writeFileSync(join(directory, `failure-browser-${index}-${p}.private.txt`), await page.locator("body").innerText().catch(() => "Page unavailable"), { mode: 0o600 });
    }
    throw error;
  } finally { await browser.close(); }
}
async function cleanup() {
  // Contact dependencies are owned by this run; the established core cleanup
  // archives immutable participation history and checks every original fingerprint.
  const versions = await sql("SELECT * FROM module_version WHERE record_id=ANY($1::uuid[])", [extra.contacts]);
  writeFileSync(join(directory, "contact-history.private.json"), JSON.stringify(versions), { mode: 0o600 });
  await sql.transaction([
    sql("LOCK TABLE module_record,module_version IN ACCESS EXCLUSIVE MODE"),
    sql("ALTER TABLE module_record DISABLE TRIGGER modules_guard"),
    sql("ALTER TABLE module_version DISABLE TRIGGER modules_version_immutable"),
    sql("DELETE FROM module_contact_account WHERE contact_id=ANY($1::uuid[])", [extra.contacts]),
    sql("DELETE FROM module_contact_legacy WHERE contact_id=ANY($1::uuid[])", [extra.contacts]),
    sql("DELETE FROM module_version WHERE record_id=ANY($1::uuid[])", [extra.contacts]),
    sql("DELETE FROM module_record WHERE id=ANY($1::uuid[])", [extra.contacts]),
    sql("DELETE FROM module_contact_profile WHERE id=ANY($1::uuid[])", [extra.profiles]),
    sql("ALTER TABLE module_record ENABLE TRIGGER modules_guard"),
    sql("ALTER TABLE module_version ENABLE TRIGGER modules_version_immutable"),
  ]);
  for (const uid of extra.external) await auth.deleteUser(uid).catch(error => { if (error.code !== "auth/user-not-found") throw error; });
  const result = spawnSync(process.execPath, ["--import", "tsx", "--env-file=.env.local", "scripts/validate-stages-1-2.ts", "--cleanup", "--directory", directory], { stdio: "inherit" });
  assert.equal(result.status, 0, "core cleanup and original fingerprints");
  const preserved = JSON.parse(readFileSync(join(directory, "results.json"), "utf8")); results.push(...preserved.results.slice(results.length));
}
async function main() {
  if (args.includes("--cleanup")) return cleanup();
  save(); let error: unknown;
  try { await execute(); } catch (e) { error = e; results.push({ assertion: "execution interrupted; inspect private diagnostic", outcome: "FAIL" }); writeFileSync(join(directory, "results.json"), JSON.stringify({ complete: false, base, results }, null, 2)); writeFileSync(join(directory, "failure.private.txt"), String((e as Error).stack ?? e), { mode: 0o600 }); }
  await cleanup();
  writeFileSync(join(directory, "results.json"), JSON.stringify({ complete: !error, base, at: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify({ directory, passed: results.filter(r => r.outcome === "PASS").length, failed: results.filter(r => r.outcome === "FAIL").length }));
  if (error) throw error;
}
void main().catch(error => { writeFileSync(join(directory, "failure-final.private.txt"), String(error?.stack ?? error), { mode: 0o600 }); console.error(error instanceof assert.AssertionError ? error.message : "Validation interrupted; inspect private diagnostic."); process.exitCode = 1; });
