/** Explicitly opt-in integration harness. Never import this file from the app. */
import { randomUUID, randomBytes, createHash, createCipheriv } from "node:crypto";
import { mkdirSync, writeFileSync, renameSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { firebaseAdminAuth } from "../src/lib/firebase-admin";
import { families, familyFields, familySchema, workflowSchema, type Family } from "../src/lib/modules/domain";

type Row = Record<string, any>;
type Entry = { table: string; key: string; value: string };
type Evidence = { assertion: string; outcome: "PASS" | "FAIL" | "BLOCKED"; status?: number; diagnostic?: string };
const args = process.argv.slice(2);
const option = (key: string) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
const baseInput = option("--base");
if (!args.includes("--allow-write") || !baseInput) {
  console.error("Uso: tsx --env-file=.env.local scripts/validate-integrated.ts --allow-write --base URL --admin-uid UID [--intake-department UUID | --protocol-pause] [--external] [--resume-cleanup MANIFESTO]");
  process.exit(2);
}
const base = new URL(baseInput);
if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error("BASE_INVALIDA");
// A destination is always supplied by the operator; no Vercel/production fallback.
for (const key of ["DATABASE_URL", "NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY"]) {
  if (!process.env[key]) throw new Error(`ENV_AUSENTE_${key}`);
}
const adminUid = option("--admin-uid");
const intakeId = option("--intake-department");
if (intakeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intakeId)) throw new Error("INTAKE_UUID_INVALIDO");
if (!adminUid) throw new Error("ADMIN_UID_EXPLICITO_OBRIGATORIO");
const root = resolve(process.env.LOCALAPPDATA ?? "", "Temp/opencode");
const resume = option("--resume-cleanup");
if (resume && !resolve(resume).startsWith(root + "\\") && !resolve(resume).startsWith(root + "/")) throw new Error("MANIFESTO_FORA_TEMP_APROVADO");
const runId = randomUUID();
const dir = resume ? resolve(resume, "..") : join(root, `integrated-${runId}`);
mkdirSync(dir, { recursive: true, mode: 0o700 });
const manifestPath = join(dir, "manifest.private.json");
const journal: { version: number; runId: string; base: string; databaseFingerprint: string; project: string; entries: Entry[]; firebase: { id: string; uid: string }[]; blobs: string[]; pending: string[] } = resume
  ? JSON.parse(readFileSync(resume, "utf8"))
  : { version: 1, runId, base: base.origin, databaseFingerprint: createHash("sha256").update(process.env.DATABASE_URL!).digest("hex"), project: process.env.FIREBASE_ADMIN_PROJECT_ID!, entries: [], firebase: [], blobs: [], pending: [] };
if (journal.version !== 1 || journal.base !== base.origin || journal.project !== process.env.FIREBASE_ADMIN_PROJECT_ID || journal.databaseFingerprint !== createHash("sha256").update(process.env.DATABASE_URL!).digest("hex")) throw new Error("MANIFESTO_AMBIENTE_DIVERGENTE");
const evidence: Evidence[] = resume
  ? (JSON.parse(readFileSync(join(dir, "results.redacted.json"), "utf8")) as { evidence: Evidence[] }).evidence
  : [];
function save() {
  writeFileSync(manifestPath + ".new", JSON.stringify(journal, null, 2), { mode: 0o600 });
  renameSync(manifestPath + ".new", manifestPath);
  writeFileSync(join(dir, "results.redacted.json"), JSON.stringify({ runId: journal.runId, executedAt: new Date().toISOString(), evidence }, null, 2), { mode: 0o600 });
}
function check(assertion: string, condition: unknown, status?: number) {
  evidence.push({ assertion, outcome: condition ? "PASS" : "FAIL", ...(status === undefined ? {} : { status }) }); save();
  if (!condition) throw new Error("ASSERTION_FAILED");
}
function blocked(assertion: string) { evidence.push({ assertion, outcome: "BLOCKED" }); save(); }
// Only fixed diagnostic categories/codes leave the process. Never serialize SQL errors,
// request bodies, provider URLs, response messages, stacks or SQL parameter arrays.
function diagnostic(error: unknown): string {
  const e = error as { code?: string; name?: string; message?: string; cause?: { code?: string } };
  const code = e?.code ?? e?.cause?.code ?? "";
  const sqlCodes: Record<string, string> = { "23503": "SQL foreign-key dependency", "23505": "SQL unique constraint", "42501": "SQL insufficient privilege", "42704": "SQL object or trigger absent", "42P01": "SQL table absent", "42703": "SQL column absent", "22012": "SQL guarded-state rejection", "55P03": "SQL lock unavailable", "40P01": "SQL deadlock", "40001": "SQL serialization conflict", "P0001": "SQL trigger rejected operation" };
  if (sqlCodes[code]) return `${code}: ${sqlCodes[code]}`;
  const firebase = new Set(["auth/user-not-found", "auth/user-disabled", "auth/insufficient-permission", "auth/id-token-revoked", "auth/invalid-credential", "auth/network-request-failed"]);
  if (firebase.has(code)) return code;
  if (["AbortError", "TimeoutError"].includes(e?.name ?? "")) return "NETWORK_TIMEOUT_OR_ABORT";
  const message = e?.message ?? "";
  if (/^(HTTP_\d{3}_(SCHEMA|AUTHORIZATION|REVISION|LEASE|BUSINESS_HOURS|STATE|SERVER|OTHER)|[A-Z][A-Z_]{2,90})$/.test(message)) return message.slice(0, 120);
  if (/fetch failed|network|ECONN|ENOTFOUND/i.test(message)) return "NETWORK_REQUEST_FAILED";
  return "UNCLASSIFIED_ERROR_DETAILS_WITHHELD";
}
function failed(assertion: string, error: unknown) { evidence.push({ assertion, outcome: "FAIL", diagnostic: diagnostic(error) }); save(); }
function own(table: string, value: string, key = "id") {
  if (!value || typeof value !== "string") throw new Error("ID_AUSENTE_NAO_LIMPAR");
  if (table === "department" && value === intakeId) throw new Error("EXISTING_INTAKE_MUST_NOT_BE_JOURNALED");
  if (!journal.entries.some(e => e.table === table && e.key === key && e.value === value)) journal.entries.push({ table, key, value });
  save(); return value;
}
const sql = neon(process.env.DATABASE_URL!);
const auth = firebaseAdminAuth();
const ident = (s: string) => { if (!/^[a-z_]+$/.test(s)) throw new Error("IDENTIFICADOR_INVALIDO"); return `"${s}"`; };
async function token(uid: string) {
  const custom = await auth.createCustomToken(uid);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_API_KEY!)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }), signal: AbortSignal.timeout(30000),
  });
  const data = await response.json() as Row;
  if (!response.ok || !data.idToken) throw new Error("FIREBASE_LOGIN_FAILED");
  return data.idToken as string;
}
async function api(label: string, path: string, bearer?: string, method = "GET", body?: unknown, statuses = [200], extraHeaders: Record<string, string> = {}) {
  const operation = `${label}:${randomUUID()}`;
  if (method === "POST") { journal.pending.push(operation); save(); }
  const response = await fetch(new URL(path, base), { method, redirect: "error", signal: AbortSignal.timeout(60000), headers: {
    ...extraHeaders,
    ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}),
  }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as Row;
  // Persist creation IDs even when an endpoint reports a partially provisioned resource.
  if (method === "POST") {
    if (path === "/api/admin/departments" && data.id) own("department", data.id);
    if (path === "/api/admin/users" && data.id) {
      own("app_user", data.id);
      if (data.firebaseUid) { journal.firebase.push({ id: data.id, uid: data.firebaseUid }); save(); }
    }
    if (["/api/documents", "/api/circulars"].includes(path) && data.id) own("document", data.id);
    if (path.startsWith("/api/modules/") && data.record?.id && !path.includes("/records/")) own("module_record", data.record.id);
    if (path === "/api/modules/external/mandates" && data.mandate?.id) own("module_mandate", data.mandate.id);
    if (path === "/api/jobs" && data.job?.id) own("document_job", data.job.id);
    if (/^\/api\/documents\/[^/]+\/attachments$/.test(path) && data.id) own("attachment", data.id);
  }
  journal.pending = journal.pending.filter(p => p !== operation); save();
  if (path.startsWith("/api/modules/anonymous")) anonymousResponseHeaders(label, response);
  if (!statuses.includes(response.status)) {
    const text = typeof data.error === "string" ? data.error : "";
    const category = data.issues || /invalid_payload|inválido|invalid/i.test(text) ? "SCHEMA" : /expediente|turno/i.test(text) ? "BUSINESS_HOURS" : /reserv|editor|lease/i.test(text) ? "LEASE" : /revis|atualiz|alterado/i.test(text) ? "REVISION" : [401, 403, 404].includes(response.status) ? "AUTHORIZATION" : response.status >= 500 ? "SERVER" : response.status === 409 ? "STATE" : "OTHER";
    const error = new Error(`HTTP_${response.status}_${category}`);
    evidence.push({ assertion: label, outcome: "FAIL", status: response.status, diagnostic: diagnostic(error) }); save(); throw error;
  }
  check(label, statuses.includes(response.status), response.status);
  return data;
}
function anonymousResponseHeaders(label: string, response: Response) {
  check(`${label}-private-headers`, response.headers.get("cache-control") === "private, no-store" && response.headers.get("referrer-policy") === "no-referrer");
}
async function ownModuleFile(recordId: string, fileId: string) {
  if (!journal.entries.some(e => e.table === "module_record" && e.key === "id" && e.value === recordId)) throw new Error("FILE_PARENT_NOT_OWNED");
  const rows = await sql(`SELECT id,storage_key,sha256 FROM module_file WHERE id=$1 AND record_id=$2`, [fileId, recordId]);
  check("module-file-owned-binding", rows.length === 1);
  own("module_file", fileId);
  if (!journal.blobs.includes(rows[0].storage_key)) journal.blobs.push(rows[0].storage_key);
  save(); return rows[0];
}
// No request is retried automatically: a timeout after commit is ambiguous.
async function scenario(label: string, fn: () => Promise<void>) {
  try { await fn(); } catch (error) { failed(label, error); }
}
function cpf() {
  const n = Array.from(randomBytes(9), x => x % 10);
  for (const length of [9, 10]) n.push((n.reduce((s, v, i) => s + v * (length + 1 - i), 0) * 10 % 11) % 10);
  return n.join("");
}
function values(family: Family): Record<string, string> {
  return Object.fromEntries((familyFields[family] ?? []).map(f => [f.key, f.options?.[0] ?? (f.type === "date" ? "2030-01-15" : f.type === "number" ? "10" : f.type === "cpfCnpj" ? cpf() : f.key === "email" ? "atendimento@example.invalid" : "Informação administrativa")]));
}
let admin = "";
async function main() {
  // Confirm the UID and database before producing login/session audit entries.
  const administrators = await sql(`SELECT u.id FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.firebase_uid=$1 AND u.active AND r.name='ADMIN_GERAL'`, [adminUid]);
  check("existing-admin-database-binding", administrators.length === 1);
  admin = await token(adminUid!);
  await api("admin-session", "/api/admin/me", admin);
  if (resume) return;
  if (intakeId) {
    const intake = await sql(`SELECT active FROM department WHERE id=$1`, [intakeId]);
    check("existing-intake-active", intake.length === 1 && intake[0].active === true);
    // This existing department is deliberately never passed to own().
  }
  const sectors: string[] = [];
  for (const name of ["Gestão Administrativa", "Planejamento", "Assessoria Técnica"]) {
    const d = await api("create-exclusive-sector", "/api/admin/departments", admin, "POST", { name: `Aurora das Veredas — ${name}`, acronym: randomBytes(4).toString("hex") }, [201]);
    sectors.push(d.id);
    const binding = await sql(`SELECT id FROM department WHERE id=$1`, [d.id]);
    check("api-sql-same-database", binding.length === 1);
  }
  const [a, b, c] = sectors;
  for (const departmentId of sectors) {
    await api("configure-exclusive-business-hours", "/api/modules/business-hours", admin, "PUT", { departmentId, revision: 0, active: true,
      shifts: [1, 2, 3, 4, 5].flatMap(day => [{ day, start: "08:00", end: "12:00" }, { day, start: "13:00", end: "17:00" }]), note: "Expediente administrativo de Aurora das Veredas." });
    own("module_business_hours", departmentId, "department_id");
  }
  const users: Row[] = [];
  for (const [i, name] of ["Helena Duarte", "Marcos Azevedo", "Clara Ribeiro", "Rafael Martins"].entries()) {
    const email = `servidor.${randomUUID()}@example.invalid`;
    const u = await api("provision-temporary-firebase-user", "/api/admin/users", admin, "POST", { name, email, departmentId: sectors[Math.min(i, 2)], secondaryDepartmentIds: i === 3 ? [a] : [], role: i === 3 ? "NIVEL_3_VISUALIZACAO" : "ADMIN_GERAL", password: randomBytes(30).toString("base64url") }, [201]);
    users.push({ ...u, email, token: await token(u.firebaseUid) });
  }
  const [ua, ub, uc, n3] = users;
  const body = { type: "MEMORANDUM", subject: "Organização dos serviços municipais", body: "Encaminhamos o planejamento das atividades de Aurora das Veredas.", originDepartmentId: a };
  let docs: Row[] = [];
  await scenario("core-documents-and-concurrency", async () => {
    // allSettled ensures both responses are journaled before finally can delete resources.
    const created = await Promise.allSettled([0, 1].map(() => api("concurrent-memorandum-create", "/api/documents", ua.token, "POST", body, [201])));
    docs = created.filter((r): r is PromiseFulfilledResult<Row> => r.status === "fulfilled").map(r => r.value);
    check("two-distinct-sequential-numbers", docs.length === 2 && docs[0].id !== docs[1].id && docs[0].displayNumber !== docs[1].displayNumber);
    for (const d of docs) {
      const race = await Promise.allSettled([0, 1].map(() => api("forward-race-valid-status", `/api/documents/${d.id}/forward`, ua.token, "POST", { departmentId: a, toDepartmentId: b }, [200, 409])));
      check("forward-race-one-winner", race.every(r => r.status === "fulfilled") && race.filter(r => r.status === "fulfilled" && r.value.ok === true).length === 1);
      await api("receive-at-b", `/api/documents/${d.id}/receive`, ub.token, "POST", { departmentId: b });
      await api("forward-b-c", `/api/documents/${d.id}/forward`, ub.token, "POST", { departmentId: b, toDepartmentId: c });
      await api("receive-at-c", `/api/documents/${d.id}/receive`, uc.token, "POST", { departmentId: c });
      const moves = await sql(`SELECT action FROM document_movement WHERE document_id=$1 AND action='FORWARDED'`, [d.id]);
      check("exactly-two-forward-events", moves.length === 2);
      for (const [action, expected] of [["conclude", "CONCLUDED"], ["archive", "ARCHIVED"], ["reopen", "OPEN"]]) {
        await api(`core-${action}`, `/api/documents/${d.id}/actions?action=${action}`, uc.token, "POST", { departmentId: c, note: "Revisão administrativa do atendimento." });
        const state = await sql(`SELECT d.status,p.state FROM document d JOIN document_participation p ON p.document_id=d.id WHERE d.id=$1 AND p.department_id=$2`, [d.id, c]);
        check(`core-${action}-persisted`, state.length === 1 && state[0].status === expected && state[0].state === expected);
      }
    }
  });
  await scenario("authorization-revocation", async () => {
    const mine = await api("two-sector-membership", "/api/admin/departments", n3.token);
    check("n3-has-two-sectors", mine.myDepartmentIds.includes(a) && mine.myDepartmentIds.includes(c));
    await api("n3-cannot-create", "/api/documents", n3.token, "POST", body, [403]);
    await api("revoke-editor-role", `/api/admin/users/${ub.id}/role`, admin, "PATCH", { role: "NIVEL_3_VISUALIZACAO" });
    await api("old-token-role-revoked", "/api/documents", ub.token, "POST", { ...body, originDepartmentId: b }, [403]);
    await api("restore-editor-role", `/api/admin/users/${ub.id}/role`, admin, "PATCH", { role: "ADMIN_GERAL" });
    await api("suspend-admin", `/api/admin/users/${ub.id}`, admin, "PATCH", { active: false });
    await api("suspended-token-rejected", "/api/admin/me", ub.token, "GET", undefined, [401]);
    await api("reactivate-own-admin", `/api/admin/users/${ub.id}`, admin, "PATCH", { active: true });
    ub.token = await token(ub.firebaseUid);
  });
  await scenario("calendar", async () => {
    const holidays = await sql(`SELECT date FROM calendar_holiday`);
    const excluded = new Set(holidays.map(h => h.date));
    const start = "2030-01-04", date = new Date(start + "T12:00:00Z");
    let days = 3;
    while (days) { date.setUTCDate(date.getUTCDate() + 1); if (![0, 6].includes(date.getUTCDay()) && !excluded.has(date.toISOString().slice(0, 10))) days--; }
    const result = await api("calendar-api", `/api/deadlines/calculate?start=${start}&days=3`, ua.token);
    check("calendar-weekend-holiday-oracle", result.dueDate === date.toISOString().slice(0, 10));
    const d = await api("create-with-deadline", "/api/documents", ua.token, "POST", { ...body, deadlines: [{ title: "Análise administrativa", dueAt: result.dueDate + "T15:00:00Z" }] }, [201]);
    const rows = await sql(`SELECT due_at AT TIME ZONE 'UTC' AS due_at FROM document_deadline WHERE document_id=$1`, [d.id]);
    check("deadline-persisted", rows.length === 1 && new Date(rows[0].due_at).toISOString() === result.dueDate + "T15:00:00.000Z");
    const workingDay = new Date("2030-01-07T12:00:00Z");
    while ([0, 6].includes(workingDay.getUTCDay()) || excluded.has(workingDay.toISOString().slice(0, 10))) workingDay.setUTCDate(workingDay.getUTCDate() + 1);
    const day = workingDay.toISOString().slice(0, 10);
    const sla = await api("business-hours-lunch-calculation", "/api/modules/business-hours", ua.token, "POST", { start: `${day}T11:00:00-03:00`, hours: 2, departmentIds: sectors });
    check("business-hours-excludes-lunch", sla.dueAt === `${day}T17:00:00.000Z`);
  });
  await scenario("concurrent-read-receipts", async () => {
    const circular = await api("create-circular", "/api/circulars", ua.token, "POST", { subject: "Calendário de atendimento", body: "Comunicamos os horários das atividades municipais.", urgency: "INFORMATIVE", originDepartmentId: a, departmentIds: [c] }, [201]);
    const reads = await Promise.allSettled(Array.from({ length: 8 }, () => api("concurrent-read", `/api/circulars/${circular.id}/read`, n3.token, "POST", {})));
    const times = reads.filter((r): r is PromiseFulfilledResult<Row> => r.status === "fulfilled").map(r => r.value.firstReadAt);
    check("immutable-first-read", times.length === 8 && !!times[0] && new Set(times).size === 1);
    const count = await sql(`SELECT count(*)::int n FROM document_read_receipt WHERE document_id=$1 AND user_id=$2`, [circular.id, n3.id]);
    check("single-receipt-in-sql", count[0].n === 1);
  });
  await scenario("original-file-hash", async () => {
    if (!docs[0]) { blocked("original-file-needs-memorandum"); return; }
    const bytes = Buffer.from("Aurora das Veredas\nMemória administrativa\n", "utf8"), form = new FormData();
    form.set("file", new Blob([bytes], { type: "text/plain" }), "memoria-administrativa.txt");
    const uploaded = await api("upload-original", `/api/documents/${docs[0].id}/attachments`, uc.token, "POST", form, [201]);
    const response = await fetch(new URL(`/api/attachments/${uploaded.id}`, base), { headers: { authorization: `Bearer ${uc.token}` }, redirect: "error", signal: AbortSignal.timeout(60000) });
    check("download-original-status", response.status === 200, response.status);
    const original = Buffer.from(await response.arrayBuffer());
    check("sha256-original-equals-download", createHash("sha256").update(bytes).digest("hex") === createHash("sha256").update(original).digest("hex"));
    await api("anonymous-file-denied", `/api/attachments/${uploaded.id}`, undefined, "GET", undefined, [401]);
  });
  await scenario("urgent-circular-forward-recipients", async () => {
    const circular = await api("create-urgent-circular", "/api/circulars", ua.token, "POST", { subject: "Providências de atendimento prioritário", body: "Encaminhamos as providências para continuidade do atendimento municipal.", urgency: "URGENT", originDepartmentId: a, departmentIds: [b] }, [201]);
    const before = await api("urgent-initial-detail", `/api/circulars/${circular.id}`, ua.token);
    check("urgent-initial-population", before.stats.total === 1 && before.stats.read === 0 && before.stats.unread === 1 && before.recipients[0].userId === ub.id);
    await api("urgent-receive-b", `/api/documents/${circular.id}/receive`, ub.token, "POST", { departmentId: b });
    await api("urgent-forward-b-c", `/api/documents/${circular.id}/forward`, ub.token, "POST", { departmentId: b, toDepartmentId: c });
    const expanded = await api("urgent-expanded-detail", `/api/circulars/${circular.id}`, ua.token);
    check("urgent-forward-adds-individual-recipients", expanded.stats.total === 3 && [ub.id, uc.id, n3.id].every(id => expanded.recipients.some((r: Row) => r.userId === id)) && expanded.stats.unread === 3);
    await api("urgent-new-recipient-read", `/api/circulars/${circular.id}/read`, n3.token, "POST", {});
    const read = await api("urgent-read-count", `/api/circulars/${circular.id}`, ua.token);
    check("urgent-read-population-count", read.stats.total === 3 && read.stats.read === 1 && read.stats.unread === 2);
    await api("urgent-update-recipients", `/api/circulars/${circular.id}/recipients`, ua.token, "PATCH", { departmentIds: [c] });
    const updated = await api("urgent-updated-count", `/api/circulars/${circular.id}`, ua.token);
    check("urgent-cancelled-recipient-excluded", updated.stats.total === 2 && updated.stats.read === 1 && updated.stats.unread === 1 && !updated.recipients.some((r: Row) => r.userId === ub.id));
    await api("urgent-removed-recipient-read-denied", `/api/circulars/${circular.id}/read`, ub.token, "POST", {}, [403]);
  });
  // Existing intake is explicit and read-only; the interactive exclusive intake remains optional.
  if (intakeId || args.includes("--protocol-pause") && process.stdin.isTTY) await scenario("anonymous-core-protocol", async () => {
    const expectedIntake = intakeId ?? a;
    if (!intakeId) {
      const { createInterface } = await import("node:readline/promises");
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      let ready = "";
      try { ready = await prompt.question(`Configure DEFAULT_INTAKE_DEPARTMENT_ID=${a} no servidor alvo, reinicie-o e digite CONFIGURADO: `); }
      finally { prompt.close(); }
      if (ready !== "CONFIGURADO") { blocked("anonymous-protocol-intake-not-confirmed"); return; }
    }
    const taxId = cpf(), email = `morador.${randomUUID()}@example.invalid`;
    const collision = await sql(`SELECT id FROM citizen WHERE cpf_cnpj=$1`, [taxId]);
    check("synthetic-cpf-not-existing", collision.length === 0);
    const payload = { name: "Lívia Monteiro", cpfCnpj: taxId, email, cep: "39999000", number: "120", city: "Aurora das Veredas", state: "MG", requestType: "Manutenção de espaço comunitário", description: "Solicitamos a manutenção do espaço comunitário municipal." };
    await api("invalid-cpf-rejected", "/api/cidadao/requerimentos", undefined, "POST", { ...payload, cpfCnpj: "11111111111" }, [400]);
    const result = await api("anonymous-protocol-created", "/api/cidadao/requerimentos", undefined, "POST", payload, [201]);
    // Resolve IDs by the exact secret returned to this request; never by broad email/name filters.
    const rows = await sql(`SELECT d.id,d.origin_department_id,e.citizen_id FROM document d JOIN external_request e ON e.document_id=d.id WHERE d.public_key=$1`, [result.publicKey]);
    check("anonymous-protocol-resolved", rows.length === 1);
    own("document", rows[0].id); own("citizen", rows[0].citizen_id);
    check("anonymous-protocol-explicit-intake", rows[0].origin_department_id === expectedIntake);
    const view = await api("anonymous-protocol-public-view", `/api/cidadao/requerimentos?key=${encodeURIComponent(result.publicKey)}`);
    const serialized = JSON.stringify(view);
    check("public-protocol-redaction", ![taxId, email, payload.name, payload.description].some(v => serialized.includes(v)) && !!view.citizenCpf);
    if (!intakeId) console.log("Restaure DEFAULT_INTAKE_DEPARTMENT_ID do servidor após esta execução; o setor exclusivo será removido.");
  }); else blocked("anonymous-core-protocol-needs-explicit-intake-or-protocol-pause");
  let flow: Row | undefined;
  let processId: string | undefined;
  await scenario("modules-workflow-lease-history", async () => {
    const family = familySchema.parse(Object.keys(families).find(f => f === "processos"));
    const workflow = workflowSchema.parse({ family, fields: [{ key: "quantidade", label: "Quantidade", type: "number", required: true }, { key: "unitario", label: "Valor unitário", type: "number", required: true }, { key: "total", label: "Total", type: "number", calculation: { operation: "multiply", fields: ["quantidade", "unitario"], decimals: 2 } }], steps: [{ name: "Instrução", departments: [a, b], hours: 24 }, { name: "Decisão", departments: [c], hours: 48, decision: true }], businessDays: true });
    flow = (await api("create-workflow", "/api/modules/fluxos", ua.token, "POST", { title: "Atendimento administrativo municipal", workflow, values: { externalEnabled: "Sim" } }, [201])).record;
    flow = (await api("activate-workflow", `/api/modules/records/${flow!.id}`, ua.token, "PATCH", { revision: flow!.revision, action: "ATIVAR" })).record;
    const input = { title: "Organização do atendimento municipal", body: "Análise dos serviços e recursos municipais.", workflowId: flow!.id, values: { ...values(family), quantidade: "3", unitario: "12.50", total: "999" }, coreDocumentIds: docs.map(d => d.id), idempotencyKey: randomUUID() };
    let record = (await api("create-process", `/api/modules/${family}`, ua.token, "POST", input, [201])).record;
    const id = record.id, initialRevision = record.revision;
    processId = id;
    const lease = await api("acquire-edit-lease", `/api/modules/records/${id}/lease`, ua.token, "POST", {});
    await api("other-editor-lease-conflict", `/api/modules/records/${id}/lease`, ub.token, "POST", {}, [409]);
    await api("invalid-lease-token-denied", `/api/modules/records/${id}`, ua.token, "PATCH", { revision: record.revision, action: "EDITAR", payload: { ...input, leaseToken: "0".repeat(64) } }, [409]);
    record = (await api("edit-with-owned-lease", `/api/modules/records/${id}`, ua.token, "PATCH", { revision: record.revision, action: "EDITAR", payload: { ...input, leaseToken: lease.token } })).record;
    await api("stale-revision-denied", `/api/modules/records/${id}`, ua.token, "PATCH", { revision: initialRevision, action: "EDITAR", payload: { ...input, leaseToken: lease.token } }, [409]);
    await api("release-owned-lease", `/api/modules/records/${id}/lease`, ua.token, "POST", { token: lease.token, release: true });
    await api("released-lease-denied", `/api/modules/records/${id}`, ua.token, "PATCH", { revision: record.revision, action: "EDITAR", payload: { ...input, leaseToken: lease.token } }, [409]);
    const renewed = await api("reacquire-edit-lease", `/api/modules/records/${id}/lease`, ua.token, "POST", {});
    check("renewed-lease-token-rotated", renewed.token !== lease.token);
    await api("stale-lease-release", `/api/modules/records/${id}/lease`, ua.token, "POST", { token: lease.token, release: true });
    await api("stale-token-denied-after-reacquire", `/api/modules/records/${id}`, ua.token, "PATCH", { revision: record.revision, action: "EDITAR", payload: { ...input, leaseToken: lease.token } }, [409]);
    record = (await api("new-lease-survives-stale-release", `/api/modules/records/${id}`, ua.token, "PATCH", { revision: record.revision, action: "EDITAR", payload: { ...input, leaseToken: renewed.token } })).record;
    await api("release-renewed-lease", `/api/modules/records/${id}/lease`, ua.token, "POST", { token: renewed.token, release: true });
    const command = async (action: string, user = ua, payload = {}) => { record = (await api(`workflow-${action}`, `/api/modules/records/${id}`, user.token, "PATCH", { revision: record.revision, action, payload, note: "Análise administrativa fundamentada." })).record; };
    await command("PROTOCOLAR");
    check("server-calculation-not-client-total", record.data.values.total === "37.50");
    check("workflow-core-document-links", docs.length === 2 && docs.every(d => record.data.coreDocumentIds.includes(d.id)));
    await api("cannot-skip-sector", `/api/modules/records/${id}`, ua.token, "PATCH", { revision: record.revision, action: "AVANCAR" }, [400, 409]);
    await command("CONCLUIR_SETOR", ua, { departmentId: a });
    await command("CONCLUIR_SETOR", ub, { departmentId: b });
    await command("AVANCAR");
    check("workflow-step-two", record.data.step === 1 && !!record.data.dueAt);
    await command("CONCLUIR_SETOR", uc, { departmentId: c });
    await command("DEFERIR", uc);
    check("workflow-final-decision", record.status === "DEFERIDO");
    const history = await api("immutable-version-readable", `/api/modules/records/${id}/versions/${initialRevision}`, ua.token);
    check("historical-revision-preserved", history.version.revision === initialRevision && history.version.snapshot.status === "RASCUNHO");
  });
  await scenario("process-tree-and-queued-zip", async () => {
    check("tree-scenario-has-owned-roots", !!processId && docs.length === 2);
    // Reverse-linked but outside ua's departments: even an ADMIN_GERAL is not a document auditor.
    const outside = (await api("create-private-outside-link", "/api/modules/ged", ub.token, "POST", { title: "Apontamentos reservados do planejamento", body: "Análise setorial de prioridades administrativas.", coreDocumentIds: [docs[0].id], linkedIds: [processId], idempotencyKey: randomUUID() }, [201])).record;
    await api("private-outside-direct-denied", `/api/modules/records/${outside.id}`, ua.token, "GET", undefined, [404]);
    for (const root of [{ type: "document", id: docs[0].id }, { type: "module", id: processId }]) {
      const tree = await api(`tree-from-${root.type}`, `/api/process-tree?type=${root.type}&id=${root.id}`, ua.token);
      const expected = [`module:${processId}`, ...docs.map(d => `document:${d.id}`)];
      check(`tree-${root.type}-both-directions`, Array.isArray(tree.nodes) && expected.every(key => tree.nodes.some((n: Row) => `${n.type}:${n.id}` === key)));
      check(`tree-${root.type}-private-outside-redacted`, ![outside.id, outside.title, outside.body].filter(Boolean).some(secret => JSON.stringify(tree).includes(secret)) && tree.nodes.length === expected.length);
    }
    const input = { kind: "ZIP", selection: "complete", sources: [{ type: "document", id: docs[0].id }], idempotencyKey: randomUUID() };
    const result = await api("enqueue-complete-zip", "/api/jobs", ua.token, "POST", input, [202]);
    const again = await api("queued-zip-idempotency", "/api/jobs", ua.token, "POST", input, [202]);
    check("zip-idempotency-same-id", result.job.id === again.job.id);
    const jobs = await sql(`SELECT owner_id,status,payload,output_key FROM document_job WHERE id=$1`, [result.job.id]);
    check("zip-owned-and-queued-without-output", jobs.length === 1 && jobs[0].owner_id === ua.id && jobs[0].status === "QUEUED" && !jobs[0].output_key);
    const sources = jobs[0].payload.sources;
    check("zip-captures-both-core-graphs", jobs[0].payload.selection === "complete" && sources.length === 3 && sources.some((s: Row) => s.type === "module" && s.id === processId) && docs.every(d => sources.some((s: Row) => s.type === "document" && s.id === d.id)));
    check("zip-private-outside-absent", !JSON.stringify(jobs[0].payload).includes(outside.id));
  });
  if (args.includes("--external") && flow) await scenario("external-owner-representative-revocation", async () => {
    // Only the temporary endpoint-created accounts are marked verified, never the existing admin.
    for (const u of [ua, ub]) { await auth.updateUser(u.firebaseUid, { emailVerified: true }); u.token = await token(u.firebaseUid); }
    const external = (await api("external-owner-create", "/api/modules/external", ua.token, "POST", { workflowId: flow!.id, title: "Solicitação de atendimento municipal", body: "Solicitamos análise administrativa dos serviços.", name: "Helena Duarte", values: { quantidade: "2", unitario: "5" }, idempotencyKey: randomUUID() }, [201])).record;
    const id = external.id;
    await api("unrepresented-user-denied", `/api/modules/external/${id}`, ub.token, "GET", undefined, [404]);
    const grant = (await api("grant-mandate", "/api/modules/external/mandates", ua.token, "POST", { representativeEmail: ub.email, families: ["processos"], recordIds: [id], permissions: ["read", "reply"], startsAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), consent: true }, [201])).mandate;
    await api("accept-mandate", `/api/modules/external/mandates/${grant.id}`, ub.token, "PATCH", { action: "ACEITAR" });
    const visible = await api("representative-read", `/api/modules/external/${id}`, ub.token);
    check("external-dto-privacy", !["publicKey", "identity", "externalOwnerUid", "participants", "data"].some(key => key in visible.record));
    await api("revoke-mandate", `/api/modules/external/mandates/${grant.id}`, ua.token, "PATCH", { action: "REVOGAR" });
    await api("revoked-representative-read-denied", `/api/modules/external/${id}`, ub.token, "GET", undefined, [404]);
    await api("revoked-representative-write-denied", `/api/modules/external/${id}`, ub.token, "PATCH", { revision: external.revision, action: "PROTOCOLAR" }, [404]);
    await api("owner-retains-access", `/api/modules/external/${id}`, ua.token);
  }); else blocked("external-opt-in-or-workflow-unavailable");
  await scenario("ombudsman-identity-and-anonymous-privacy", async () => {
    const family = familySchema.parse("ouvidoria");
    const category = "Relato documental";
    const workflow = workflowSchema.parse({ family, identityDepartmentId: a, fields: [], requiredFiles: [category], businessDays: true, steps: [{ name: "Análise", departments: [a, b, c], hours: 24, decision: true }] });
    let f = (await api("ombudsman-flow-create", "/api/modules/fluxos", ua.token, "POST", { title: "Atendimento da Ouvidoria municipal", workflow, values: { anonymousEnabled: "Sim" } }, [201])).record;
    f = (await api("ombudsman-flow-activate", `/api/modules/records/${f.id}`, ua.token, "PATCH", { revision: f.revision, action: "ATIVAR" })).record;
    const v = values(family); v.modalidade = familyFields.ouvidoria!.find(x => x.key === "modalidade")!.options![1];
    const identity = { name: "Lívia Monteiro", email: `morador.${randomUUID()}@example.invalid`, cpfCnpj: cpf(), phone: "" };
    const r = (await api("confidential-identity-create", "/api/modules/ouvidoria", ua.token, "POST", { title: "Atendimento de serviços urbanos", body: "Solicitamos análise da manutenção dos serviços urbanos.", workflowId: f.id, values: v, identity }, [201])).record;
    const view = await api("nonidentity-sector-detail", `/api/modules/records/${r.id}`, ub.token);
    check("nonidentity-sector-redacted", !JSON.stringify(view).includes(identity.email) && !JSON.stringify(view).includes(identity.cpfCnpj));
    const historical = await api("nonidentity-sector-history", `/api/modules/records/${r.id}/versions/${r.revision}`, ub.token);
    check("historical-identity-redacted", !JSON.stringify(historical).includes(identity.email) && !JSON.stringify(historical).includes(identity.cpfCnpj));
    const key = randomBytes(32).toString("hex");
    const anonymous = await api("anonymous-ombudsman-create", "/api/modules/anonymous", undefined, "POST", { action: "CREATE", key, workflowId: f.id, title: "Conservação dos espaços municipais", body: "Solicitamos a conservação dos espaços de convivência municipais.", purpose: "Solicitação", values: {} });
    const rows = await sql(`SELECT r.id,r.data FROM module_record r JOIN module_anonymous_access a ON a.record_id=r.id WHERE a.token_hash=$1`, [createHash("sha256").update(key).digest("hex")]);
    check("anonymous-owned-record-resolved", rows.length === 1 && !!anonymous.code);
    own("module_record", rows[0].id);
    check("anonymous-identity-absent-in-storage", !rows[0].data.identity);
    const anonymousView = await api("anonymous-ombudsman-read", "/api/modules/anonymous", undefined, "POST", { action: "READ", key });
    check("anonymous-read-dto-private", !["identity", "publicKey", "participants", "data", "externalOwnerUid"].some(k => k in anonymousView));
    check("anonymous-created-as-draft", anonymousView.code === anonymous.code && anonymousView.status === "RASCUNHO" && Number.isInteger(anonymousView.revision));
    const anonymousId = rows[0].id;
    const readAnonymous = () => api("anonymous-current-read", "/api/modules/anonymous", undefined, "POST", { action: "READ", key });
    check("anonymous-required-category-visible", anonymousView.requiredFiles.includes(category));
    await api("anonymous-submit-without-required-file-denied", "/api/modules/anonymous", undefined, "POST", { action: "SUBMIT", key, operationId: randomUUID(), revision: anonymousView.revision }, [409]);
    check("missing-file-submit-is-atomic", (await readAnonymous()).revision === anonymousView.revision);
    const form = (bytes: Uint8Array, filename: string, mime: string, operationId: string, revision: number) => {
      const data = new FormData();
      data.set("file", new Blob([Buffer.from(bytes)], { type: mime }), filename);
      data.set("category", category); data.set("operationId", operationId); data.set("revision", String(revision));
      return data;
    };
    const upload = (label: string, bytes: Uint8Array, filename: string, mime: string, operationId: string, revision: number, statuses = [200], suppliedKey: string | null = key) =>
      api(label, "/api/modules/anonymous/files", undefined, "POST", form(bytes, filename, mime, operationId, revision), statuses, suppliedKey ? { "x-anonymous-key": suppliedKey } : {});
    const txt = Buffer.from("Solicitamos a conservação do espaço comunitário municipal.\n", "utf8");
    await upload("anonymous-upload-missing-key", txt, "relato.txt", "text/plain", randomUUID(), anonymousView.revision, [400], null);
    await upload("anonymous-upload-wrong-key", txt, "relato.txt", "text/plain", randomUUID(), anonymousView.revision, [404], randomBytes(32).toString("hex"));
    await upload("anonymous-upload-invalid-extension", txt, "relato.exe", "application/octet-stream", randomUUID(), anonymousView.revision, [400]);
    await upload("anonymous-upload-forged-pdf", txt, "relato.pdf", "application/pdf", randomUUID(), anonymousView.revision, [400]);
    await upload("anonymous-upload-binary-txt", Buffer.from([65, 0, 66]), "relato.txt", "text/plain", randomUUID(), anonymousView.revision, [400]);
    check("invalid-uploads-do-not-change-revision", (await readAnonymous()).revision === anonymousView.revision);
    const txtOperation = randomUUID();
    const uploaded = await upload("anonymous-upload-txt", txt, "relato.txt", "text/plain", txtOperation, anonymousView.revision);
    const txtRow = await ownModuleFile(anonymousId, uploaded.fileId);
    const retried = await upload("anonymous-upload-idempotent-retry", txt, "relato.txt", "text/plain", txtOperation, anonymousView.revision);
    check("anonymous-file-retry-same-result", uploaded.saved === true && uploaded.fileId === retried.fileId && uploaded.revision === retried.revision);
    await upload("anonymous-file-idempotency-content-conflict", Buffer.from("Outro relato administrativo."), "relato.txt", "text/plain", txtOperation, anonymousView.revision, [409]);
    const afterTxt = await readAnonymous();
    check("anonymous-txt-single-file-single-revision", afterTxt.revision === anonymousView.revision + 1 && afterTxt.files.length === 1 && afterTxt.files[0].id === uploaded.fileId);
    const operationRows = await sql(`SELECT result FROM module_anonymous_operation WHERE record_id=$1 AND operation_id=$2`, [anonymousId, txtOperation]);
    check("anonymous-upload-operation-persisted-once", operationRows.length === 1 && operationRows[0].result.fileId === uploaded.fileId);
    const downloadAnonymous = async (label: string, fileId: string, expected: Uint8Array, mime: string) => {
      const response = await fetch(new URL(`/api/modules/anonymous/files/${fileId}`, base), { method: "POST", headers: { "x-anonymous-key": key }, redirect: "error", signal: AbortSignal.timeout(60000) });
      check(`${label}-status`, response.status === 200, response.status); anonymousResponseHeaders(label, response);
      check(`${label}-download-headers`, response.headers.get("content-type") === mime && response.headers.get("x-content-type-options") === "nosniff" && response.headers.get("content-disposition")?.startsWith("attachment;"));
      const actual = Buffer.from(await response.arrayBuffer());
      check(`${label}-original-sha256`, createHash("sha256").update(expected).digest("hex") === createHash("sha256").update(actual).digest("hex"));
    };
    check("anonymous-txt-stored-sha256", txtRow.sha256 === createHash("sha256").update(txt).digest("hex"));
    await downloadAnonymous("anonymous-txt", uploaded.fileId, txt, "text/plain");
    await api("anonymous-file-download-wrong-key", `/api/modules/anonymous/files/${uploaded.fileId}`, undefined, "POST", undefined, [404], { "x-anonymous-key": randomBytes(32).toString("hex") });
    await api("anonymous-file-download-missing-key", `/api/modules/anonymous/files/${uploaded.fileId}`, undefined, "POST", undefined, [400]);
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create(); pdf.addPage([400, 400]).drawText("Memoria dos espacos municipais", { x: 30, y: 350, size: 12 });
    const pdfBytes = await pdf.save();
    const pdfUpload = await upload("anonymous-upload-pdf", pdfBytes, "memoria.pdf", "application/pdf", randomUUID(), afterTxt.revision);
    const pdfRow = await ownModuleFile(anonymousId, pdfUpload.fileId);
    check("anonymous-pdf-stored-sha256", pdfRow.sha256 === createHash("sha256").update(pdfBytes).digest("hex"));
    await downloadAnonymous("anonymous-pdf", pdfUpload.fileId, pdfBytes, "application/pdf");
    // Independent subscenario: a rendering failure must not suppress evaluation/reopening checks.
    await scenario("anonymous-pdf-measurement-and-derived-drawing", async () => {
      let revision = (await readAnonymous()).revision;
      const measurement = { fileId: pdfUpload.fileId, page: 1, scale: 2, type: "distancia", points: [[20, 20], [23, 24]], shape: "polyline", coordinateSystem: "PDF_VIEWPORT_POINTS", color: "#d91d48", width: 2, opacity: 0.8, precision: 2, fileHash: pdfRow.sha256 };
      await api("measurement-original-hash-mismatch-denied", `/api/modules/records/${anonymousId}`, ua.token, "PATCH", { revision, action: "MEDIR", payload: { ...measurement, fileHash: "0".repeat(64) } }, [409]);
      let measured = (await api("measure-pdf-distance", `/api/modules/records/${anonymousId}`, ua.token, "PATCH", { revision, action: "MEDIR", payload: measurement })).record;
      check("pdf-distance-independent-oracle", measured.data.measurements.at(-1).result === 10);
      await api("measurement-stale-revision-denied", `/api/modules/records/${anonymousId}`, ua.token, "PATCH", { revision, action: "MEDIR", payload: measurement }, [409]);
      measured = (await api("measure-pdf-rectangle", `/api/modules/records/${anonymousId}`, ua.token, "PATCH", { revision: measured.revision, action: "MEDIR", payload: { ...measurement, type: "area", shape: "rectangle", points: [[40, 40], [140, 90]] } })).record;
      check("pdf-area-independent-oracle", measured.data.measurements.at(-1).result === 20000);
      const derived = await api("draw-measurements-on-pdf-copy", `/api/modules/records/${anonymousId}/annotate`, ua.token, "POST", { revision: measured.revision, fileId: pdfUpload.fileId, stamp: "Analise administrativa municipal" });
      const derivedRow = await ownModuleFile(anonymousId, derived.fileId);
      const response = await fetch(new URL(`/api/modules/records/${anonymousId}/files/${derived.fileId}`, base), { headers: { authorization: `Bearer ${ua.token}` }, redirect: "error", signal: AbortSignal.timeout(60000) });
      check("derived-pdf-download-status", response.status === 200, response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      check("derived-pdf-hash-and-original-distinct", createHash("sha256").update(bytes).digest("hex") === derived.sha256 && derivedRow.sha256 === derived.sha256 && derived.sha256 !== pdfRow.sha256);
      const parsed = await PDFDocument.load(bytes);
      check("derived-pdf-readable-single-page", parsed.getPageCount() === 1);
      await downloadAnonymous("anonymous-pdf-original-after-drawing", pdfUpload.fileId, pdfBytes, "application/pdf");
      await api("internal-derived-file-not-anonymous", `/api/modules/anonymous/files/${derived.fileId}`, undefined, "POST", undefined, [404], { "x-anonymous-key": key });
    });
    const beforeSubmit = await readAnonymous();
    check("anonymous-visible-originals-only", beforeSubmit.files.length === 2 && [uploaded.fileId, pdfUpload.fileId].every(id => beforeSubmit.files.some((file: Row) => file.id === id)));
    await api("anonymous-submit", "/api/modules/anonymous", undefined, "POST", { action: "SUBMIT", key, operationId: randomUUID(), revision: beforeSubmit.revision });
    const submitted = await api("anonymous-read-after-submit", "/api/modules/anonymous", undefined, "POST", { action: "READ", key });
    check("anonymous-submitted-state", submitted.code === anonymousView.code && submitted.status === "EM_ANDAMENTO" && submitted.revision > anonymousView.revision && !!submitted.dueAt);
    await api("anonymous-evaluate-before-conclusion-denied", "/api/modules/anonymous", undefined, "POST", { action: "EVALUATE", key, operationId: randomUUID(), revision: submitted.revision, score: 5 }, [409]);
    const command = async (action: string, user: Row, payload = {}, note = "Análise administrativa fundamentada.") => {
      const current = await readAnonymous();
      return (await api(`anonymous-internal-${action}`, `/api/modules/records/${anonymousId}`, user.token, "PATCH", { revision: current.revision, action, payload, note })).record;
    };
    for (const [user, departmentId] of [[ua, a], [ub, b], [uc, c]] as [Row, string][]) await command("CONCLUIR_SETOR", user, { departmentId });
    await command("DEFERIR", ua);
    let finished = await readAnonymous();
    check("anonymous-can-evaluate-only-after-all-sectors", finished.status === "DEFERIDO" && finished.canEvaluate === true);
    for (const score of [0, 6]) await api("anonymous-evaluation-score-out-of-range", "/api/modules/anonymous", undefined, "POST", { action: "EVALUATE", key, operationId: randomUUID(), revision: finished.revision, score }, [400]);
    for (const score of [1, 5]) {
      const operationId = randomUUID(), revision = finished.revision;
      const evaluation = { action: "EVALUATE", key, operationId, revision, score, text: "Avaliação do atendimento municipal." };
      const saved = await api("anonymous-save-evaluation", "/api/modules/anonymous", undefined, "POST", evaluation);
      const retry = await api("anonymous-evaluation-idempotent-retry", "/api/modules/anonymous", undefined, "POST", evaluation);
      finished = await readAnonymous();
      check("anonymous-evaluation-replaced-and-idempotent", saved.revision === retry.revision && finished.revision === revision + 1 && finished.evaluation.score === score && finished.evaluation.cycle === 0);
    }
    await api("anonymous-reopen-without-note-denied", `/api/modules/records/${anonymousId}`, ua.token, "PATCH", { revision: finished.revision, action: "REABRIR", note: "" }, [400]);
    await command("REABRIR", ua, {}, "Nova análise solicitada para complementar as providências.");
    const reopened = await readAnonymous();
    check("anonymous-reopen-clears-evaluation", reopened.status === "EM_ANDAMENTO" && reopened.canEvaluate === false && !reopened.evaluation);
    await api("anonymous-reopened-evaluation-denied", "/api/modules/anonymous", undefined, "POST", { action: "EVALUATE", key, operationId: randomUUID(), revision: reopened.revision, score: 5 }, [409]);
    for (const [user, departmentId] of [[ua, a], [ub, b], [uc, c]] as [Row, string][]) await command("CONCLUIR_SETOR", user, { departmentId });
    await command("DEFERIR", ua);
    const secondCycle = await readAnonymous();
    await api("anonymous-evaluation-new-cycle", "/api/modules/anonymous", undefined, "POST", { action: "EVALUATE", key, operationId: randomUUID(), revision: secondCycle.revision, score: 4 });
    check("anonymous-evaluation-cycle-incremented", (await readAnonymous()).evaluation?.cycle === 1);
    await api("wrong-anonymous-key-denied", "/api/modules/anonymous", undefined, "POST", { action: "READ", key: randomBytes(32).toString("hex") }, [404]);
  });
}

async function cleanup() {
  // Expand only explicit, known child relations of journaled resources. Never search by name/email.
  const relations: [string, string, string][] = [
    ["operation_participation_history", "document_id", "document"],
    ["document_access", "document_id", "document"],
    ["document_deadline", "document_id", "document"], ["document_recipient", "document_id", "document"], ["document_read_receipt", "document_id", "document"],
    ["document_movement", "document_id", "document"], ["document_participation", "document_id", "document"], ["attachment", "document_id", "document"],
    ["email_message", "document_id", "document"], ["external_request", "document_id", "document"],
    ["module_version", "record_id", "module_record"], ["module_file", "record_id", "module_record"], ["module_edit_lease", "record_id", "module_record"],
    ["module_anonymous_access", "record_id", "module_record"], ["module_sector_tag", "record_id", "module_record"], ["module_passcode", "record_id", "module_record"],
    ["module_anonymous_operation", "record_id", "module_record"], ["citizen_identity", "citizen_id", "citizen"],
    ["module_business_hours", "department_id", "department"], ["document_job_text", "job_id", "document_job"],
    ["user_role", "user_id", "app_user"], ["user_profile", "user_id", "app_user"], ["user_department", "user_id", "app_user"],
    ["user_admin_department", "user_id", "app_user"],
  ];
  const allowed = new Set(["department:id", "app_user:id", "document:id", "citizen:id", "attachment:id", "module_file:id", "module_record:id", "module_mandate:id", "document_job:id", ...relations.map(([t, k]) => `${t}:${k}`)]);
  if (journal.entries.some(e => !allowed.has(`${e.table}:${e.key}`) || !/^[0-9a-f-]{36}$/i.test(e.value))) throw new Error("MANIFESTO_NAO_RECONHECIDO");
  const tables = new Set((await sql(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)).map(r => r.table_name));
  // Recover only jobs owned by endpoint-created users from this manifest. No assignee/global scan.
  const owners = journal.entries.filter(e => e.table === "app_user" && e.key === "id").map(e => e.value);
  if (tables.has("document_job")) for (const owner of owners) {
    const jobs = await sql(`SELECT id FROM document_job WHERE owner_id=$1`, [owner]);
    for (const job of jobs) own("document_job", job.id);
  }
  for (const e of journal.entries.filter(e => e.table === "document_job")) {
    const jobs = await sql(`SELECT owner_id,status,output_key FROM document_job WHERE id=$1`, [e.value]);
    if (jobs.some(j => !owners.includes(j.owner_id) || j.status !== "QUEUED" || j.output_key)) throw new Error("JOB_NOT_QUEUED_PRESERVE_OUTPUT_AND_RECOVER");
  }
  for (const [table, key, parent] of relations) if (tables.has(table)) {
    for (const e of [...journal.entries].filter(e => e.table === parent && e.key === "id")) {
      const rows = await sql(`SELECT * FROM ${ident(table)} WHERE ${ident(key)}=$1`, [e.value]);
      if (rows.length) own(table, e.value, key);
      for (const row of rows) if (["attachment", "module_file"].includes(table) && row.storage_key && !journal.blobs.includes(row.storage_key)) journal.blobs.push(row.storage_key);
    }
  }
  // Recover Firebase UID only through a journaled SQL ID, including partial provisioning.
  for (const e of journal.entries.filter(e => e.table === "app_user" && e.key === "id")) {
    const rows = await sql(`SELECT firebase_uid FROM app_user WHERE id=$1`, [e.value]);
    const uid = rows[0]?.firebase_uid;
    if (uid && !journal.firebase.some(u => u.id === e.value && u.uid === uid)) journal.firebase.push({ id: e.value, uid });
  }
  if (journal.firebase.some(u => u.uid === adminUid || !journal.entries.some(e => e.table === "app_user" && e.key === "id" && e.value === u.id))) throw new Error("FIREBASE_OWNERSHIP_UNPROVEN");
  save();
  // Preserve non-PII historical projections before deleting FK-bound versions/movements.
  const history: Row[] = [];
  const archive: Row[] = [];
  for (const e of journal.entries) {
    const rows = await sql(`SELECT * FROM ${ident(e.table)} WHERE ${ident(e.key)}=$1`, [e.value]);
    if (rows.length) archive.push({ scope: e, rows });
  }
  // Exact history goes into an encrypted private archive, never into JSON evidence.
  if (archive.length) {
    const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(archive), "utf8"), cipher.final()]);
    const stamp = randomUUID();
    writeFileSync(join(dir, `history-${stamp}.key`), key, { mode: 0o600 });
    writeFileSync(join(dir, `history-${stamp}.aes`), Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
  }
  for (const e of journal.entries.filter(e => ["document_movement", "module_version"].includes(e.table))) {
    const rows = await sql(`SELECT * FROM ${ident(e.table)} WHERE ${ident(e.key)}=$1`, [e.value]);
    history.push(...rows.map(r => ({ table: e.table, action: r.action, revision: r.revision, at: r.created_at, status: r.snapshot?.status })));
  }
  if (history.length) writeFileSync(join(dir, "history.redacted.json"), JSON.stringify(history, null, 2), { mode: 0o600 });
  // audit_log is retained in the database; no global counters, roles or calendars are changed.
  // Delete dependents first in ONE transaction. Unknown/new FKs fail closed and rollback.
  const order = [...relations.map(([t]) => t), "document_job", "module_mandate", "module_record", "document", "citizen", "app_user", "department"];
  const ordered = [...journal.entries].sort((a, b) => order.indexOf(a.table) - order.indexOf(b.table));
  // Immutable history is archived above. DDL and scoped deletes share a transaction:
  // exclusive locks prevent concurrent writes while these known guards are suspended.
  const guards: [string, string][] = [["module_record", "modules_guard"], ["module_version", "modules_version_immutable"], ["module_file", "modules_file_immutable"], ["module_mandate", "modules_mandate_no_delete"], ["module_anonymous_operation", "anonymous_operation_immutable"], ["operation_participation_history", "operation_participation_history_immutable"]];
  const activeGuards = guards.filter(([table]) => ordered.some(e => e.table === table));
  let sqlFailure = false;
  try {
    if (ordered.length) await sql.transaction([
      sql(`SET LOCAL lock_timeout='10s'`),
      // Lock/recheck job state before deleting any dependents. A worker claim causes rollback,
      // never removal of its text/output or account. Missing rows are safe on cleanup resume.
      ...ordered.filter(e => e.table === "document_job").map(e => sql(`WITH locked AS (SELECT owner_id,status,output_key FROM document_job WHERE id=$1 FOR UPDATE) SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM locked WHERE status <> 'QUEUED' OR output_key IS NOT NULL OR NOT(owner_id=ANY($2::uuid[]))) THEN 1 ELSE 0 END AS guarded`, [e.value, owners])),
      ...activeGuards.map(([t]) => sql(`LOCK TABLE ${ident(t)} IN ACCESS EXCLUSIVE MODE`)),
      ...activeGuards.map(([t, g]) => sql(`ALTER TABLE ${ident(t)} DISABLE TRIGGER ${ident(g)}`)),
      ...ordered.map(e => sql(`DELETE FROM ${ident(e.table)} WHERE ${ident(e.key)}=$1`, [e.value])),
      ...activeGuards.map(([t, g]) => sql(`ALTER TABLE ${ident(t)} ENABLE TRIGGER ${ident(g)}`)),
    ]);
    check("sql-teardown-transaction", true);
  } catch (error) { sqlFailure = true; failed("sql-teardown-rolled-back", error); }
  if (sqlFailure) throw new Error("SQL_TEARDOWN_PENDING");
  let firebaseFailure = false;
  for (const u of journal.firebase) {
    try { await auth.deleteUser(u.uid); } catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") { firebaseFailure = true; failed("firebase-delete-pending", error); } }
  }
  if (!sqlFailure && journal.blobs.length) {
    const { del } = await import("@vercel/blob");
    for (const pathname of journal.blobs) await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN?.trim().replace(/^"|"$/g, "") });
  }
  check("firebase-teardown", !firebaseFailure);
  journal.pending = journal.pending.filter(p => p !== "cleanup:recovery-required"); save();
  if (journal.pending.length) blocked("ambiguous-request-outcome-manual-reconciliation-required");
}

async function preserveAccountsForRecovery() {
  if (!journal.pending.includes("cleanup:recovery-required")) journal.pending.push("cleanup:recovery-required");
  save();
  for (const u of journal.firebase) {
    if (u.uid === adminUid || !journal.entries.some(e => e.table === "app_user" && e.key === "id" && e.value === u.id)) continue;
    try {
      const rows = await sql(`SELECT id FROM app_user WHERE id=$1 AND firebase_uid=$2`, [u.id, u.uid]);
      if (!rows.length) continue;
      await auth.updateUser(u.uid, { disabled: true });
      await auth.revokeRefreshTokens(u.uid);
      evidence.push({ assertion: "own-firebase-account-disabled-preserved-for-recovery", outcome: "BLOCKED" }); save();
    } catch (error) { failed("own-account-quarantine-pending", error); }
  }
}

async function run() {
  save();
  try { await main(); }
  catch (error) { failed("setup-or-execution", error); }
  finally {
    try { await cleanup(); }
    catch (error) { failed("teardown-incomplete-use-private-manifest", error); await preserveAccountsForRecovery(); }
    save();
  }
  console.log(`Evidências privadas: ${dir}`);
  console.log(JSON.stringify({ passed: evidence.filter(e => e.outcome === "PASS").length, failed: evidence.filter(e => e.outcome === "FAIL").length, blocked: evidence.filter(e => e.outcome === "BLOCKED").length }));
  process.exitCode = evidence.some(e => e.outcome === "FAIL") ? 1 : evidence.some(e => e.outcome === "BLOCKED") ? 2 : 0;
}
void run().catch(error => { console.error(`HARNESS_FAILED: ${diagnostic(error)}`); process.exitCode = 1; });
