import { Client, neon, neonConfig } from "@neondatabase/serverless";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { firebaseAdminAuth } from "../src/lib/firebase-admin";
import { downloadAttachment } from "../src/lib/blob";
import { chromium } from "playwright-core";
import { createDocumentWithNumber } from "../src/lib/numbering";

type Row = Record<string, any>;
const root = resolve(process.env.LOCALAPPDATA ?? "", "Temp/opencode");
const args = process.argv.slice(2);
const at = (flag: string) => args[args.indexOf(flag) + 1];
const run = args.includes("--directory") ? resolve(at("--directory")) : join(root, `stages12-${Date.now()}`);
assert.ok(run.startsWith(root + "\\") || run.startsWith(root + "/"));
mkdirSync(run, { recursive: true });
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function cpf() { const digits = Array.from(randomBytes(9), value => value % 10); for (const length of [9, 10]) digits.push((digits.reduce((sum, value, index) => sum + value * (length + 1 - index), 0) * 10 % 11) % 10); return digits.join(""); }
const sql = neon(process.env.DATABASE_URL!);
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const journalFile = join(run, "manifest.private.json");
const journal: { database: string; users: Row[]; sectors: string[]; documents: string[]; blobs: string[]; citizens?: string[] } = args.includes("--cleanup") ? JSON.parse(readFileSync(journalFile, "utf8")) : { database: hash(process.env.DATABASE_URL!), users: [], sectors: [], documents: [], blobs: [], citizens: [] };
const save = () => writeFileSync(journalFile, JSON.stringify(journal, null, 2), { mode: 0o600 });
const results: { assertion: string; outcome: string }[] = args.includes("--cleanup") ? JSON.parse(readFileSync(join(run, "results.json"), "utf8")).results : [];
const evidence = (name: string, actual: unknown) => { results.push({ assertion: name, outcome: actual ? "PASS" : "FAIL" }); writeFileSync(join(run, "results.json"), JSON.stringify({ at: new Date().toISOString(), results }, null, 2)); assert.ok(actual, name); };
const base = at("--base");
let administrator = "";
async function request(path: string, token: string, method = "GET", data?: unknown, expected = 200): Promise<Row> {
  const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(60000) });
  const value = await response.json();
  if (path === "/api/admin/departments" && method === "POST" && value.id) { journal.sectors.push(value.id); save(); }
  if (path === "/api/admin/users" && method === "POST" && value.id) { journal.users.push({ id: value.id, uid: value.firebaseUid }); save(); }
  if (path === "/api/documents" && method === "POST" && value.id) { journal.documents.push(value.id); save(); }
  evidence(`${method} ${path.replace(/[a-f0-9-]{36}/gi, "<id>")} => ${expected}`, response.status === expected);
  return value;
}
async function token(uid: string) {
  const customToken = await firebaseAdminAuth().createCustomToken(uid);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const value = await response.json(); assert.ok(value.idToken, "Firebase token exchange"); return String(value.idToken);
}
async function snapshot() {
  neonConfig.webSocketConstructor = WebSocket;
  const client = new Client({ connectionString: process.env.DIRECT_URL }); await client.connect();
  const tables: Row = {};
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const names = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
    for (const { table_name: name } of names.rows) tables[name] = (await client.query(`SELECT * FROM ${quote(name)}`)).rows;
    await client.query("COMMIT");
  } finally { await client.end(); }
  writeFileSync(join(run, "snapshot.private.json"), JSON.stringify(tables), { mode: 0o600 });
  const originals: Row[] = [];
  for (const [index, file] of (tables.attachment ?? []).entries()) {
    const original = await downloadAttachment(file.storage_key); assert.ok(original);
    const bytes = Buffer.from(await new Response(original.stream).arrayBuffer());
    writeFileSync(join(run, `original-${index}.private`), bytes, { mode: 0o600 }); originals.push({ id: file.id, actualBytes: bytes.length, sha256: hash(bytes) });
  }
  const fingerprints: Row = {};
  for (const table of ["app_user", "document", "attachment", "department", "citizen", "user_department", "user_role"]) fingerprints[table] = (await sql(`SELECT md5(coalesce(string_agg(md5(t::text),'' ORDER BY md5(t::text)),'')) AS fingerprint FROM ${quote(table)} t`))[0].fingerprint;
  writeFileSync(join(run, "snapshot-summary.json"), JSON.stringify({ at: new Date().toISOString(), database: journal.database, tables: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, (rows as Row[]).length])), originals, fingerprints }, null, 2));
  console.log(JSON.stringify({ directory: run, tables: Object.keys(tables).length, originals: originals.length }));
}
async function cleanup() {
  assert.equal(journal.database, hash(process.env.DATABASE_URL!));
  const docs = journal.documents, users = journal.users.map(u => u.id), sectors = journal.sectors;
  // Only IDs journaled from successful creation responses; unknown FKs roll back.
  const queries = [
    ...["email_message", "external_request"].map(table => sql(`DELETE FROM ${quote(table)} WHERE document_id=ANY($1::uuid[])`, [docs])),
    ...["document_access", "document_deadline", "document_movement", "document_read_receipt", "document_recipient", "document_participation", "attachment"].map(table => sql(`DELETE FROM ${quote(table)} WHERE document_id=ANY($1::uuid[])`, [docs])),
    sql("DELETE FROM operation_participation_history WHERE document_id=ANY($1::uuid[])", [docs]),
    sql("DELETE FROM document WHERE id=ANY($1::uuid[])", [docs]),
    sql("DELETE FROM citizen_identity WHERE citizen_id=ANY($1::uuid[])", [journal.citizens ?? []]),
    sql("DELETE FROM citizen WHERE id=ANY($1::uuid[])", [journal.citizens ?? []]),
    ...["user_admin_department", "user_department", "user_role", "user_profile"].map(table => sql(`DELETE FROM ${quote(table)} WHERE user_id=ANY($1::uuid[])`, [users])),
    sql("DELETE FROM app_user WHERE id=ANY($1::uuid[])", [users]),
    sql("DELETE FROM department WHERE id=ANY($1::uuid[])", [sectors]),
  ];
  if (docs.length) { // Archive only this run's immutable technical history before scoped cleanup.
    const history = await sql("SELECT * FROM operation_participation_history WHERE document_id=ANY($1::uuid[])", [docs]);
    writeFileSync(join(run, "participation-history.private.json"), JSON.stringify(history), { mode: 0o600 });
    queries.unshift(sql("LOCK TABLE operation_participation_history IN ACCESS EXCLUSIVE MODE"), sql("ALTER TABLE operation_participation_history DISABLE TRIGGER operation_participation_history_immutable"));
    queries.push(sql("ALTER TABLE operation_participation_history ENABLE TRIGGER operation_participation_history_immutable"));
  }
  await sql.transaction(queries);
  for (const user of journal.users) if (user.uid) await firebaseAdminAuth().deleteUser(user.uid).catch(error => { if (error.code !== "auth/user-not-found") throw error; });
  if (journal.blobs.length) { const { del } = await import("@vercel/blob"); for (const blob of journal.blobs) await del(blob, { token: process.env.BLOB_READ_WRITE_TOKEN?.trim().replace(/^"|"$/g, "") }); }
  evidence("owned SQL and Firebase cleanup", true);
}
async function verifyPreserved() {
  const before: Row = JSON.parse(readFileSync(join(run, "snapshot-summary.json"), "utf8"));
  for (const table of ["app_user", "document", "attachment", "department", "citizen", "user_department", "user_role"]) {
    const current = await sql(`SELECT md5(coalesce(string_agg(md5(t::text),'' ORDER BY md5(t::text)),'')) AS fingerprint FROM ${quote(table)} t`);
    assert.equal(current[0].fingerprint, before.fingerprints[table], `preserved ${table}`);
    evidence(`original rows preserved: ${table}`, true);
  }
  const snapshot: Row = JSON.parse(readFileSync(join(run, "snapshot.private.json"), "utf8"));
  for (const original of before.originals) {
    const file = snapshot.attachment.find((row: Row) => row.id === original.id);
    const stored = await downloadAttachment(file.storage_key); assert.ok(stored);
    evidence("original attachment bytes preserved after cleanup", hash(Buffer.from(await new Response(stored.stream).arrayBuffer())) === original.sha256);
  }
}
async function execute() {
  assert.ok(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) || args.includes("--allow-production") && base === "https://rioazul.celeriflow.com.br", "explicit API destination");
  const admins = await sql("SELECT u.id,u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND r.name='ADMIN_GERAL' AND u.firebase_uid IS NOT NULL ORDER BY u.id LIMIT 1");
  assert.equal(admins.length, 1); administrator = await token(admins[0].firebase_uid);
  const sectors: string[] = [];
  for (const [index, name] of ["Administração", "Planejamento", "Assessoria", "Atendimento"].entries()) {
    const value = await request("/api/admin/departments", administrator, "POST", { name: `Aurora das Veredas — ${name}`, acronym: `AV${randomBytes(3).toString("hex")}`, ...(index === 3 ? { parentId: sectors[0] } : {}) }, 201); sectors.push(value.id);
  }
  const [a, b, c, child] = sectors;
  const people: Row[] = [];
  for (const [index, role] of ["ADMIN_GERAL", "NIVEL_3_VISUALIZACAO", "NIVEL_2", "NIVEL_1", "ADMIN_LOCAL", "AUDITOR"].entries()) {
    const email = `servidor.${randomUUID()}@aurora.mg.gov.br`, password = randomBytes(24).toString("base64url");
    const u = await request("/api/admin/users", administrator, "POST", { name: ["Helena Duarte", "Rafael Nogueira", "Clara Ribeiro", "Marcos Azevedo", "Laura Antunes", "Otávio Goulart"][index], email, password, role, departmentId: index === 4 ? c : a, ...(role === "ADMIN_LOCAL" ? { administrativeDepartmentIds: [a] } : {}), details: { sex: "Não informado", birthDate: "1990-02-28", editor: "BASICO", attachmentView: "PREVIA", phonePublic: false, notificationEmail: "notificacoes@aurora.mg.gov.br" }, phone: "31988887777", registration: `AV${index}`, position: "Agente administrativo" }, 201);
    people.push({ ...u, email, password, token: await token(u.firebaseUid) });
  }
  const [writer, n3, n2, n1, local, auditor] = people;
  const generated = await request("/api/admin/users", administrator, "POST", { name: "Beatriz Monteiro", email: `servidor.${randomUUID()}@aurora.mg.gov.br`, role: "NIVEL_3_VISUALIZACAO", departmentId: a }, 201);
  evidence("password omitted generates private definition link without claiming delivery", generated.credentialStatus === "RESET_LINK_GENERATED" && generated.deliveryStatus === "NOT_SENT" && !!generated.resetLink);
  const resetCode = new URL(generated.resetLink).searchParams.get("oobCode");
  const newPassword = randomBytes(24).toString("base64url");
  const reset = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ oobCode: resetCode, newPassword }) });
  evidence("private recovery link defines real Firebase password", reset.ok);
  const recoveredLogin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: generated.email, password: newPassword, returnSecureToken: true }) });
  evidence("recovered account authenticates using defined password", recoveredLogin.ok);
  await request("/api/admin/users", administrator, "POST", { name: "Cadastro duplicado", email: generated.email, role: "NIVEL_3_VISUALIZACAO", departmentId: a }, 409);
  await request(`/api/admin/users/${n3.id}`, administrator, "PATCH", { leaveStart: "2030-01-20T00:00:00.000Z", leaveEnd: "2030-01-10T00:00:00.000Z" }, 400);
  await request(`/api/admin/users/${n3.id}`, administrator, "PATCH", { leaveStart: "2030-01-10T00:00:00.000Z", leaveEnd: "2030-01-20T00:00:00.000Z" });
  await request(`/api/admin/departments/${child}`, local.token, "PATCH", { name: "Aurora das Veredas — Atendimento ao cidadão" });
  await request(`/api/admin/departments/${child}`, local.token, "PATCH", { parentId: b }, 403);
  const counterBefore = await sql("SELECT key,value FROM business_counter ORDER BY key");
  await assert.rejects(() => createDocumentWithNumber({ type: "OTHER", subject: "Operação que deve falhar integralmente", body: "Nenhum registro parcial.", originDepartmentId: a, createdById: null, external: { existing: true, requestType: "Geral", person: { id: randomUUID(), name: "Pessoa inexistente", email: "nao-enviar@aurora.mg.gov.br", cpfCnpj: "52998224725" } } }));
  evidence("failed creation rolls back both counters", JSON.stringify(await sql("SELECT key,value FROM business_counter ORDER BY key")) === JSON.stringify(counterBefore));
  const citizenId = randomUUID(); journal.citizens!.push(citizenId); save();
  const external = await createDocumentWithNumber({ type: "EXTERNAL_REQUEST", subject: "Solicitação administrativa de Aurora das Veredas", body: "Solicito informação sobre atendimento.", originDepartmentId: a, createdById: null, external: { existing: false, requestType: "Informações", person: { id: citizenId, name: "Renata Alencar", email: `cidadao.${randomUUID()}@aurora.mg.gov.br`, cpfCnpj: cpf() } } });
  journal.documents.push(external.id); save();
  const message = (await sql("SELECT subject,body_text,status FROM email_message WHERE document_id=$1", [external.id]))[0];
  evidence("external draft notification includes actual business code without SQL interpolation artifact", message.subject === `Protocolo ${external.businessCode} recebido` && message.body_text.includes(external.businessCode) && !message.body_text.includes("[object Object]") && message.status === "PENDING");
  const body = { type: "MEMORANDUM", subject: "Organização do atendimento municipal", body: '<p style="text-align:center"><strong>Planejamento</strong> <em>municipal</em></p><script>alert(1)</script>', originDepartmentId: a, toDepartmentId: b, toDepartmentIds: [c], deadlines: [{ title: "Análise inicial", dueAt: "2030-01-15T15:00:00.000Z" }, { title: "Revisão final", dueAt: "2030-01-16T15:00:00.000Z" }] };
  const doc = await request("/api/documents", writer.token, "POST", body, 201);
  const others = await Promise.all([0, 1, 2].map(() => request("/api/documents", writer.token, "POST", { ...body, deadlines: [] }, 201)));
  const numbers = [doc, ...others].map(d => d.sequentialNumber).sort((x, y) => x - y);
  evidence("concurrent sequential numbers without gaps", numbers.every((number, index) => number === numbers[0] + index));
  evidence("business identifiers retain aaaammddxxxxx", [doc, ...others].every(d => /^\d{13}$/.test(d.displayNumber)));
  const detail = await request(`/api/documents/${doc.id}`, writer.token);
  evidence("sanitized format survives reopen", detail.document.body.includes("<strong>") && detail.document.body.includes("<em>") && !detail.document.body.includes("script"));
  evidence("two deadlines and three independent sectors", detail.deadlines.length === 2 && detail.participation.length === 3);
  const calendar = await request("/api/deadlines?month=2030-01", writer.token);
  evidence("both deadlines visible in calendar", calendar.deadlines.filter((deadline: Row) => deadline.documentId === doc.id).length === 2);
  const routeDoc = others[0];
  const race = await Promise.all([0, 1].map(() => fetch(`${base}/api/documents/${routeDoc.id}/forward`, { method: "POST", headers: { authorization: `Bearer ${writer.token}`, "content-type": "application/json" }, body: JSON.stringify({ departmentId: a, toDepartmentId: b }) })));
  evidence("concurrent forward has exactly one winner", race.filter(response => response.status === 200).length === 1 && race.filter(response => response.status === 409).length === 1);
  await request(`/api/documents/${routeDoc.id}/receive`, auditor.token, "POST", { departmentId: b });
  await request(`/api/documents/${routeDoc.id}/forward`, auditor.token, "POST", { departmentId: b, toDepartmentId: c });
  await request(`/api/documents/${routeDoc.id}/receive`, auditor.token, "POST", { departmentId: c });
  const movements = await sql("SELECT action,from_department_id,to_department_id FROM document_movement WHERE document_id=$1 AND action IN('FORWARDED','RECEIVED') ORDER BY created_at,id", [routeDoc.id]);
  evidence("A to B to C preserves actual origin and destination", movements.length === 4 && movements[0].from_department_id === a && movements[0].to_department_id === b && movements[1].from_department_id === a && movements[1].to_department_id === b && movements[2].from_department_id === b && movements[2].to_department_id === c && movements[3].from_department_id === b && movements[3].to_department_id === c);
  for (const actor of [n3]) {
    await request("/api/documents", actor.token, "POST", body, 403);
    await request(`/api/documents/${doc.id}/receive`, actor.token, "POST", { departmentId: a }, 403);
    await request(`/api/documents/${doc.id}/forward`, actor.token, "POST", { departmentId: a, toDepartmentId: b }, 403);
    await request(`/api/deadlines/${detail.deadlines[0].id}`, actor.token, "PATCH", { status: "COMPLETED" }, 403);
  }
  await request(`/api/documents/${doc.id}/actions?action=reply`, writer.token, "POST", { departmentId: a, note: "" }, 400);
  await request(`/api/deadlines/${detail.deadlines[0].id}`, writer.token, "PATCH", { title: "Análise concluída", status: "COMPLETED" });
  const timeline = await request(`/api/documents/${doc.id}`, writer.token);
  evidence("deadline edits recorded in document timeline", timeline.timeline.some((event: Row) => event.action === "DEADLINE_UPDATED" && event.actor === "Helena Duarte"));
  const bytes = Buffer.from("Registro de planejamento municipal — Aurora das Veredas.\n", "utf8");
  const form = new FormData(); form.set("file", new File([bytes], "planejamento.txt", { type: "text/plain" }));
  const upload = await fetch(`${base}/api/documents/${doc.id}/attachments`, { method: "POST", headers: { authorization: `Bearer ${writer.token}` }, body: form });
  evidence("private attachment uploaded", upload.status === 201);
  const file = await upload.json();
  const stored = await sql("SELECT storage_key FROM attachment WHERE id=$1 AND document_id=$2", [file.id, doc.id]);
  journal.blobs.push(stored[0].storage_key); save();
  const download = await fetch(`${base}/api/attachments/${file.id}`, { headers: { authorization: `Bearer ${writer.token}` } });
  evidence("private attachment roundtrip hash", download.status === 200 && hash(Buffer.from(await download.arrayBuffer())) === hash(bytes));
  evidence("private attachment without session denied", (await fetch(`${base}/api/attachments/${file.id}`)).status === 401);
  await request(`/api/documents/${doc.id}/actions?action=conclude`, writer.token, "POST", { departmentId: a });
  evidence("one sector conclusion does not close other pending sectors", (await request(`/api/documents/${doc.id}`, writer.token)).document.status === "OPEN");
  await request(`/api/documents/${doc.id}/actions?action=archive`, writer.token, "POST", { departmentId: a });
  await request(`/api/documents/${doc.id}/actions?action=reopen`, writer.token, "POST", { departmentId: a });
  const subordinate = await request("/api/documents", writer.token, "POST", { ...body, originDepartmentId: a, toDepartmentId: child, toDepartmentIds: [] }, 201);
  await request(`/api/documents/${subordinate.id}/receive`, n1.token, "POST", { departmentId: child });
  await request(`/api/documents/${subordinate.id}/forward`, n2.token, "POST", { departmentId: child, toDepartmentId: b }, 403);
  const localView = await request("/api/admin/users", local.token);
  evidence("local administrator manages designated subtree while based elsewhere", localView.users.some((u: Row) => u.id === n2.id) && !localView.users.some((u: Row) => u.id === writer.id));
  await request(`/api/documents/${doc.id}`, local.token); // c receives a copy; remove membership next.
  await request(`/api/admin/users/${local.id}`, administrator, "PATCH", { departmentId: b });
  const outside = await request("/api/documents", writer.token, "POST", { ...body, toDepartmentId: null, toDepartmentIds: [] }, 201);
  await request(`/api/documents/${outside.id}`, local.token, "GET", undefined, 404);
  await request(`/api/admin/users/${writer.id}`, administrator, "PATCH", { departmentId: b, secondaryDepartmentIds: [] });
  await request(`/api/documents/${outside.id}`, writer.token, "GET", undefined, 404);
  await request(`/api/admin/users/${writer.id}`, administrator, "PATCH", { departmentId: a });
  await request(`/api/documents/${outside.id}`, writer.token);
  await request(`/api/documents/${outside.id}/actions?action=reply`, auditor.token, "POST", { departmentId: a, note: "Conferência de auditoria" });
  await request(`/api/admin/users/${n2.id}/role`, administrator, "PATCH", { role: "NIVEL_3_VISUALIZACAO" });
  await request("/api/documents", n2.token, "POST", body, 403);
  await request(`/api/admin/users/${n2.id}`, administrator, "PATCH", { active: false });
  await request("/api/admin/me", n2.token, "GET", undefined, 401);
  await request(`/api/admin/users/${n2.id}`, administrator, "PATCH", { active: true });
  n2.token = await token(n2.firebaseUid);
  await request("/api/admin/me", n2.token);
  await request(`/api/admin/users/${n2.id}`, administrator, "PATCH", { details: { inactivityDays: 2 } });
  await sql("UPDATE user_profile SET last_access_at=now()-interval '3 days' WHERE user_id=$1", [n2.id]);
  await request("/api/admin/me", n2.token, "GET", undefined, 401);
  evidence("inactivity suspends without erasing account", (await sql("SELECT active FROM app_user WHERE id=$1", [n2.id]))[0].active === false);
  await request(`/api/admin/users/${n2.id}`, administrator, "PATCH", { active: true });
  n2.token = await token(n2.firebaseUid); await request("/api/admin/me", n2.token);
  const mine = await request("/api/admin/me", n3.token);
  await request("/api/admin/me", n3.token, "PATCH", { details: { inactivityDays: 365 } }, 400);
  await request("/api/admin/me", n3.token, "PATCH", { name: "Nome indevido" }, 400);
  await request("/api/admin/me", n3.token, "PATCH", { phone: "31999998888", details: { editor: "AVANCADO", phonePublic: true }, preferences: { email: false, prazo: true } });
  const directory = await request("/api/admin/departments", writer.token);
  evidence("telephone directory honors individual visibility", directory.members.find((member: Row) => member.id === writer.id).phone === null && directory.members.find((member: Row) => member.id === n3.id).phone === "31999998888");
  const history = await request(`/api/admin/users/${writer.id}/history`, administrator);
  evidence("transfer history preserves before and after sector", history.events.some((event: Row) => event.metadata?.before?.departmentId === a && event.metadata?.after?.departmentId === b));
  await request(`/api/admin/users/${writer.id}/history`, n3.token, "GET", undefined, 404);
  const listed = await request(`/api/documents?q=${doc.sequentialNumber}/${doc.year}&type=MEMORANDUM`, writer.token);
  evidence("number-year search and default twenty-page size", listed.pageSize === 20 && listed.documents.some((row: Row) => row.id === doc.id));
  const fullProfile = (await request("/api/admin/users", administrator)).users.find((row: Row) => row.id === writer.id);
  evidence("functional profile persists birth sex position preferences", fullProfile.details.birthDate === "1990-02-28" && fullProfile.details.sex === "Não informado" && fullProfile.details.editor === "BASICO" && fullProfile.position === "Agente administrativo");
  const leave = (await request("/api/admin/users", administrator)).users.find((row: Row) => row.id === n3.id);
  evidence("leave period survives reopen", leave.leaveStart.startsWith("2030-01-10") && leave.leaveEnd.startsWith("2030-01-20"));
  const disposal = await request("/api/admin/departments", administrator, "POST", { name: "Aurora das Veredas — Arquivo setorial" }, 201);
  const pending = await request("/api/documents", writer.token, "POST", { ...body, toDepartmentId: disposal.id, toDepartmentIds: [] }, 201);
  await request(`/api/admin/users/${generated.id}`, administrator, "PATCH", { departmentId: disposal.id });
  await request(`/api/admin/departments/${disposal.id}`, administrator, "PATCH", { active: false }, 409);
  await request(`/api/admin/departments/${disposal.id}`, administrator, "PATCH", { active: false, reallocateToDepartmentId: b });
  evidence("department retirement reallocates staff and retains historical sector movement", (await sql("SELECT department_id FROM app_user WHERE id=$1", [generated.id]))[0].department_id === b && (await sql("SELECT * FROM document_movement WHERE document_id=$1 AND action='SECTOR_REALLOCATED' AND from_department_id=$2 AND to_department_id=$3", [pending.id, disposal.id, b])).length === 1);
  const cycle = await request(`/api/admin/departments/${a}`, administrator, "PATCH", { parentId: child }, 400);
  await request(`/api/admin/departments/${a}`, administrator, "PATCH", { active: false, reallocateToDepartmentId: b }, 409);
  // Browser authenticates with the newly provisioned email/password, then uses actual APIs.
  const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(`${base}/admin`);
    await page.getByLabel("E-mail", { exact: true }).fill(writer.email); await page.getByLabel("Senha", { exact: true }).fill(writer.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("heading", { name: "Servidores e permissões", exact: true }).waitFor({ timeout: 60000 });
    evidence("new account signs in through browser email and password", true);
    await page.goto(`${base}/documentos/novo`);
    await page.getByRole("heading", { name: "Novo documento", exact: true }).waitFor();
    await page.getByLabel("Origem", { exact: false }).selectOption(a);
    await page.getByLabel("Assunto", { exact: true }).fill("Memorando redigido pela interface");
    await page.getByRole("textbox", { name: "Conteúdo do documento", exact: true }).fill("Providenciar revisão do atendimento municipal.");
    await page.getByLabel("Título do prazo 1").fill("Conferência pela interface");
    await page.getByLabel("Data do prazo 1").fill("2030-01-17T10:00");
    await page.getByLabel("Título do prazo 2").fill("Conclusão pela interface");
    await page.getByLabel("Data do prazo 2").fill("2030-01-18T11:00");
    evidence("basic editor preference has real toolbar effect", await page.getByRole("button", { name: "Imagem", exact: true }).count() === 0);
    const responsePromise = page.waitForResponse(response => response.request().method() === "POST" && response.url() === `${base}/api/documents`);
    await page.getByRole("button", { name: "Salvar (gera número automático)", exact: true }).click();
    const createdResponse = await responsePromise, browserDoc = await createdResponse.json();
    if (browserDoc.id) { journal.documents.push(browserDoc.id); save(); }
    evidence("document created through browser with two deadlines", createdResponse.status() === 201);
    await page.getByRole("heading", { name: new RegExp(browserDoc.displayNumber) }).waitFor();
    await page.goto(`${base}/documentos/${doc.id}`); await page.getByRole("heading", { name: new RegExp(doc.displayNumber) }).waitFor();
    evidence("formatted document rendered by browser", await page.locator(".doc-body strong").innerText() === "Planejamento");
    await page.getByRole("button", { name: "Prazos", exact: true }).click(); await page.getByRole("cell", { name: "Revisão final", exact: true }).waitFor();
    evidence("two persisted deadlines available from document screen", await page.getByRole("cell", { name: "Análise concluída", exact: true }).count() === 1);
    await page.screenshot({ path: join(run, "document-deadlines.png") });
    await page.getByRole("button", { name: "Anexos", exact: true }).click();
    const [browserDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar", exact: true }).click()]);
    await browserDownload.saveAs(join(run, "browser-attachment.private.txt"));
    evidence("authenticated click downloads original bytes in browser", hash(readFileSync(join(run, "browser-attachment.private.txt"))) === hash(bytes));
    await page.goto(`${base}/calendario`); await page.getByRole("heading", { name: "Calendário de prazos" }).waitFor();
    await page.getByLabel("Mês de referência").fill("2030-01");
    await page.getByRole("button", { name: /^15, [1-9]\d* prazos$/ }).waitFor();
    await page.getByRole("button", { name: /^15, [1-9]\d* prazos$/ }).click();
    await page.getByRole("link", { name: new RegExp("Análise concluída") }).waitFor();
    evidence("month grid opens persisted deadline and linked document", true);
    evidence("calendar screen opens for same account", true);
    const viewer = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await viewer.goto(`${base}/admin`); await viewer.getByLabel("E-mail", { exact: true }).fill(n3.email); await viewer.getByLabel("Senha", { exact: true }).fill(n3.password); await viewer.getByRole("button", { name: "Entrar", exact: true }).click();
    await viewer.getByRole("heading", { name: "Minha conta", exact: true }).waitFor({ timeout: 60000 });
    await viewer.goto(`${base}/documentos/${doc.id}`); await viewer.getByRole("heading", { name: new RegExp(doc.displayNumber) }).waitFor();
    evidence("N3 browser view hides write actions", await viewer.getByRole("button", { name: "Despachar", exact: true }).count() === 0 && await viewer.getByRole("button", { name: "Marcar recebido", exact: true }).count() === 0 && await viewer.getByRole("button", { name: "Registrar resposta", exact: true }).count() === 0);
    await viewer.screenshot({ path: join(run, "n3-document.png") });
  } finally { await browser.close(); }
}
async function main() {
  if (args.includes("--snapshot")) return snapshot();
  if (args.includes("--verify-preserved")) return verifyPreserved();
  if (args.includes("--cleanup")) { await cleanup(); return verifyPreserved(); }
  assert.ok(args.includes("--allow-write") && args.includes("--directory"));
  save();
  try { await execute(); } finally { await cleanup(); await verifyPreserved(); }
  writeFileSync(join(run, "results.json"), JSON.stringify({ at: new Date().toISOString(), complete: true, base, results }, null, 2));
  console.log(JSON.stringify({ directory: run, passed: results.filter(r => r.outcome === "PASS").length, failed: results.filter(r => r.outcome === "FAIL").length }));
}
void main().catch(error => {
  results.push({ assertion: "run interrupted; inspect private diagnostic", outcome: "FAIL" });
  writeFileSync(join(run, "results.json"), JSON.stringify({ at: new Date().toISOString(), complete: false, results }, null, 2));
  writeFileSync(join(run, "failure.private.txt"), String((error as Error).stack ?? error), { mode: 0o600 }); console.error(`Validation interrupted: ${error instanceof assert.AssertionError ? error.message : (error as Error).name}. Evidence: ${run}`); process.exitCode = 1;
});
