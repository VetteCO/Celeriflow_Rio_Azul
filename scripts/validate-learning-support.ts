/** Opt-in real API validation. No workers, migrations or shared configuration changes. */
import { randomUUID, randomBytes, createHash, createCipheriv } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { neon } from "@neondatabase/serverless";
import { firebaseAdminAuth } from "../src/lib/firebase-admin";
import { PDFDocument } from "pdf-lib";

type Row = Record<string, any>;
type Entry = { table: string; key: string; id: string };
type Evidence = { assertion: string; outcome: "PASS" | "FAIL"; status?: number; diagnostic?: string };
const args = process.argv.slice(2);
const option = (s: string) => { const i = args.indexOf(s); return i < 0 ? undefined : args[i + 1]; };
if (!args.includes("--allow-write") || !option("--base") || !args.includes("--resolve-admin-from-db")) {
  console.error("Required: --allow-write --base URL --resolve-admin-from-db [--resume-cleanup MANIFEST]"); process.exit(2);
}
const base = new URL(option("--base")!);
if (!/^https?:$/.test(base.protocol) || base.pathname !== "/" || base.search || base.hash || base.username || base.password) throw new Error("INVALID_BASE");
for (const k of ["DATABASE_URL", "NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY", "LOCALAPPDATA"]) if (!process.env[k]) throw new Error("MISSING_ENVIRONMENT");
const sql = neon(process.env.DATABASE_URL!);
const auth = firebaseAdminAuth();
const root = resolve(process.env.LOCALAPPDATA!, "Temp/opencode");
const resume = option("--resume-cleanup");
if (resume && !resolve(resume).startsWith(root + "\\") && !resolve(resume).startsWith(root + "/")) throw new Error("INVALID_MANIFEST_LOCATION");
const fingerprint = createHash("sha256").update(process.env.DATABASE_URL!).digest("hex");
const dir = resume ? dirname(resolve(resume)) : join(root, `learning-support-${randomUUID()}`);
mkdirSync(dir, { recursive: true, mode: 0o700 });
const manifestPath = join(dir, "manifest.private.json");
const journal: { base: string; fingerprint: string; project: string; entries: Entry[]; users: { id: string; uid: string }[]; pending: string[]; cleanupComplete: boolean } = resume
  ? JSON.parse(readFileSync(resume, "utf8"))
  : { base: base.origin, fingerprint, project: process.env.FIREBASE_ADMIN_PROJECT_ID!, entries: [], users: [], pending: [], cleanupComplete: false };
if (journal.base !== base.origin || journal.fingerprint !== fingerprint || journal.project !== process.env.FIREBASE_ADMIN_PROJECT_ID) throw new Error("MANIFEST_ENVIRONMENT_MISMATCH");
const evidence: Evidence[] = resume ? JSON.parse(readFileSync(join(dir, "results.redacted.json"), "utf8")).evidence : [];
function save() {
  writeFileSync(manifestPath + ".new", JSON.stringify(journal, null, 2), { mode: 0o600 }); renameSync(manifestPath + ".new", manifestPath);
  writeFileSync(join(dir, "results.redacted.json"), JSON.stringify({ updatedAt: new Date().toISOString(), evidence }, null, 2), { mode: 0o600 });
}
function safeError(error: unknown) {
  const e = error as { code?: string; message?: string; name?: string };
  const codes: Record<string, string> = { "23503": "SQL_FOREIGN_KEY", "23505": "SQL_UNIQUE", "42501": "SQL_PRIVILEGE", "42P01": "SQL_TABLE_ABSENT", "55P03": "SQL_LOCK_TIMEOUT", "auth/user-not-found": "FIREBASE_USER_ABSENT" };
  if (codes[e?.code ?? ""]) return codes[e.code!];
  if (/^(ASSERTION_FAILED|HTTP_\d{3}|FIREBASE_LOGIN_FAILED|UNKNOWN_OWNERSHIP|SQL_CLEANUP_PENDING|NETWORK_FAILURE)$/.test(e?.message ?? "")) return e.message;
  if (/fetch|network|timeout|abort/i.test(`${e?.name ?? ""} ${e?.message ?? ""}`)) return "NETWORK_FAILURE";
  return "UNCLASSIFIED_ERROR_DETAILS_WITHHELD";
}
function fail(assertion: string, error: unknown) { evidence.push({ assertion, outcome: "FAIL", diagnostic: safeError(error) }); save(); }
function check(assertion: string, ok: unknown, status?: number) { evidence.push({ assertion, outcome: ok ? "PASS" : "FAIL", ...(status === undefined ? {} : { status }) }); save(); if (!ok) throw new Error("ASSERTION_FAILED"); }
function own(table: string, id: string, key = "id") { if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) throw new Error("UNKNOWN_OWNERSHIP"); if (!journal.entries.some(e => e.table === table && e.id === id && e.key === key)) journal.entries.push({ table, id, key }); save(); }
async function login(uid: string) {
  const token = await auth.createCustomToken(uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_API_KEY!)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, returnSecureToken: true }), signal: AbortSignal.timeout(30000) });
  const data = await res.json() as Row;
  if (!res.ok || !data.idToken) throw new Error("FIREBASE_LOGIN_FAILED"); return data.idToken as string;
}
async function api(label: string, path: string, token?: string, method = "GET", body?: unknown, expected = [200]) {
  const operation = `${label}:${randomUUID()}`;
  if (method !== "GET") { journal.pending.push(operation); save(); }
  const res = await fetch(new URL(path, base), { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(60000) });
  const data = await res.json().catch(() => ({})) as Row;
  if (method === "POST") {
    if (path === "/api/admin/departments" && data.id) own("department", data.id);
    if (path === "/api/admin/users" && data.id) { own("app_user", data.id); if (data.firebaseUid) journal.users.push({ id: data.id, uid: data.firebaseUid }); }
    if (data.course?.id && path === "/api/operations/courses") own("operation_course", data.course.id);
    if (data.ticket?.id && path === "/api/operations/tickets") own("operation_ticket", data.ticket.id);
    if (data.progress?.id) own("operation_progress", data.progress.id);
  }
  journal.pending = journal.pending.filter(x => x !== operation); save();
  check(label, expected.includes(res.status), res.status);
  return data;
}
async function scenario(label: string, fn: () => Promise<void>) { try { await fn(); } catch (e) { fail(label, e); } }
let existingAdminUid = "";
async function main() {
  const admins = await sql(`SELECT DISTINCT u.id,u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND u.firebase_uid IS NOT NULL AND r.name='ADMIN_GERAL' AND lower(u.email) NOT LIKE '%@example.invalid' ORDER BY u.id`);
  // Resolve a provider-active existing admin without printing identifiers or credentials.
  for (const candidate of admins) { const u = await auth.getUser(candidate.firebase_uid).catch(() => null); if (u && !u.disabled) { existingAdminUid = u.uid; break; } }
  check("existing-active-admin-resolved", !!existingAdminUid);
  const admin = await login(existingAdminUid);
  await api("existing-admin-session", "/api/admin/me", admin);
  if (resume) return;
  const dept = (await api("create-exclusive-sector", "/api/admin/departments", admin, "POST", { name: "Santa Aurora do Vale — Desenvolvimento Institucional", acronym: randomBytes(4).toString("hex") }, [201])).id;
  check("api-database-binding", (await sql(`SELECT id FROM department WHERE id=$1`, [dept])).length === 1);
  const users: Row[] = [];
  for (const [name, role] of [["Helena Duarte", "ADMIN_GERAL"], ["Marcos Azevedo", "NIVEL_3_VISUALIZACAO"], ["Clara Ribeiro", "NIVEL_3_VISUALIZACAO"]]) {
    const u = await api("provision-owned-user", "/api/admin/users", admin, "POST", { name, role, email: `servidor.${randomUUID()}@example.invalid`, departmentId: dept, password: randomBytes(30).toString("base64url") }, [201]);
    users.push({ ...u, name, token: await login(u.firebaseUid) });
  }
  const [manager, learner, other] = users;
  await scenario("learning-lifecycle", async () => {
    const input = { title: "Atendimento e gestão documental municipal", module: "Gestão documental", passScore: 75,
      lessons: [{ title: "Recepção de solicitações", videoUrl: "https://example.invalid/recepcao", content: "Registre a solicitação e encaminhe ao setor competente." }, { title: "Proteção das informações", videoUrl: "https://example.invalid/protecao", content: "Restrinja o acesso às informações pessoais aos responsáveis." }],
      questions: [{ prompt: "Qual é o primeiro procedimento?", options: ["Registrar a solicitação", "Descartar a solicitação"], answer: 0 }, { prompt: "Como proteger informações pessoais?", options: ["Divulgar sem restrição", "Restringir o acesso"], answer: 1 }] };
    await api("n3-cannot-create-course", "/api/operations/courses", learner.token, "POST", input, [403]);
    await api("invalid-course-threshold-denied", "/api/operations/courses", manager.token, "POST", { ...input, passScore: 101 }, [400]);
    const course = (await api("create-owned-two-lesson-course", "/api/operations/courses", manager.token, "POST", input, [201])).course;
    const path = `/api/operations/courses/${course.id}`;
    const listing = await api("learner-course-list", "/api/operations/courses", learner.token);
    const visible = listing.courses.find((c: Row) => c.id === course.id);
    check("course-published-without-answer-key", visible?.lessons.length === 2 && visible.passScore === 75 && visible.questions.every((q: Row) => !Object.hasOwn(q, "answer")));
    await api("certificate-before-completion-denied", path, learner.token, "GET", undefined, [404]);
    await api("cannot-skip-first-lesson", path, learner.token, "POST", { action: "lesson", index: 1 }, [409]);
    await api("assessment-before-lessons-denied", path, learner.token, "POST", { action: "assessment", answers: [0, 1] }, [409]);
    await api("out-of-range-lesson-denied", path, learner.token, "POST", { action: "lesson", index: 2 }, [400]);
    let progress = (await api("complete-first-lesson", path, learner.token, "POST", { action: "lesson", index: 0 })).progress;
    check("first-lesson-progress", progress.completed === 1 && !progress.certificateCode);
    const repeat = (await api("lesson-idempotency", path, learner.token, "POST", { action: "lesson", index: 0 })).progress;
    check("lesson-repeat-does-not-advance", repeat.completed === 1 && repeat.id === progress.id);
    await api("assessment-after-only-one-lesson-denied", path, learner.token, "POST", { action: "assessment", answers: [0, 1] }, [409]);
    await api("complete-second-lesson", path, learner.token, "POST", { action: "lesson", index: 1 });
    await api("incomplete-assessment-denied", path, learner.token, "POST", { action: "assessment", answers: [0] }, [400]);
    progress = (await api("assessment-failed", path, learner.token, "POST", { action: "assessment", answers: [0, 0] })).progress;
    check("failed-score-without-certificate", progress.score === 50 && !progress.certificateCode && !progress.certifiedAt);
    await api("failed-assessment-no-certificate", path, learner.token, "GET", undefined, [404]);
    progress = (await api("assessment-passed", path, learner.token, "POST", { action: "assessment", answers: [0, 1] })).progress;
    check("passed-score-certified", progress.completed === 2 && progress.score === 100 && !!progress.certificateCode && !!progress.certifiedAt);
    await api("certified-assessment-immutable", path, learner.token, "POST", { action: "assessment", answers: [1, 0] }, [409]);
    const download = async () => {
      const response = await fetch(new URL(path, base), { headers: { authorization: `Bearer ${learner.token}` }, redirect: "error", signal: AbortSignal.timeout(60000) });
      check("certificate-download-status", response.status === 200, response.status);
      check("certificate-private-pdf-headers", response.headers.get("content-type") === "application/pdf" && response.headers.get("cache-control") === "private, no-store" && response.headers.get("content-disposition")?.startsWith("attachment;"));
      return Buffer.from(await response.arrayBuffer());
    };
    const bytes = await download(), again = await download();
    check("certificate-stable-sha256", createHash("sha256").update(bytes).digest("hex") === createHash("sha256").update(again).digest("hex"));
    check("certificate-parseable-pdf", bytes.subarray(0, 5).toString() === "%PDF-" && (await PDFDocument.load(bytes)).getPageCount() === 1);
    check("certificate-bound-to-own-learner", bytes.toString("latin1").includes(learner.name) && bytes.toString("latin1").includes(progress.certificateCode));
    await api("other-user-certificate-denied", path, other.token, "GET", undefined, [404]);
    await api("query-user-id-cannot-impersonate", `${path}?userId=${learner.id}`, other.token, "GET", undefined, [404]);
    await api("anonymous-certificate-denied", path, undefined, "GET", undefined, [401]);
    const otherList = await api("other-user-own-progress-only", "/api/operations/courses", other.token);
    check("other-user-no-progress-leak", otherList.courses.find((c: Row) => c.id === course.id)?.progress === null);
    const stored = await sql(`SELECT score,completed,certificate_code FROM operation_progress WHERE id=$1`, [progress.id]);
    check("certificate-sql-immutable", stored.length === 1 && stored[0].score === 100 && stored[0].completed === 2 && stored[0].certificate_code === progress.certificateCode);
  });
  await scenario("support-lifecycle", async () => {
    let chosen: Row | undefined;
    for (const [severity, hours] of [["CRITICAL", 2], ["HIGH", 8], ["NORMAL", 24]] as const) {
      const ticket = (await api(`create-${severity.toLowerCase()}-ticket`, "/api/operations/tickets", learner.token, "POST", { subject: "Orientação para atendimento documental", message: "Solicitamos orientação sobre o fluxo de atendimento documental municipal.", severity }, [201])).ticket;
      check(`ticket-${severity.toLowerCase()}-sla`, ticket.severity === severity && ticket.status === "OPEN" && Date.parse(ticket.dueAt) - Date.parse(ticket.history[0].at) === hours * 3600000 && !ticket.firstResponseAt && !ticket.rating);
      if (severity === "HIGH") chosen = ticket;
    }
    const id = chosen!.id, path = `/api/operations/tickets/${id}`;
    await api("ticket-other-user-read-denied", path, other.token, "GET", undefined, [404]);
    await api("ticket-other-user-write-denied", path, other.token, "PATCH", { message: "Solicito alteração do atendimento." }, [404]);
    await api("ticket-anonymous-denied", path, undefined, "GET", undefined, [401]);
    const privateList = await api("other-user-ticket-list", "/api/operations/tickets", other.token);
    check("ticket-list-private-to-requester", privateList.manager === false && !privateList.tickets.some((t: Row) => journal.entries.some(e => e.table === "operation_ticket" && e.id === t.id)));
    await api("n3-cannot-change-ticket-status", path, learner.token, "PATCH", { message: "Solicito encaminhamento.", status: "ESCALATED" }, [403]);
    await api("n3-cannot-assign-ticket", path, learner.token, "PATCH", { message: "Solicito atribuição.", assigneeId: other.id }, [403]);
    await api("n3-cannot-close-ticket", path, learner.token, "PATCH", { message: "Solicito encerramento.", status: "RESOLVED" }, [403]);
    await api("rating-before-closure-denied", path, learner.token, "PATCH", { message: "Avaliação do atendimento.", rating: 5 }, [409]);
    const replied = (await api("requester-reply", path, learner.token, "PATCH", { message: "Complementamos a solicitação com detalhes do fluxo." })).ticket;
    check("requester-reply-is-not-support-first-response", replied.history.length === 2 && !replied.firstResponseAt);
    await api("manager-invalid-assignee-denied", path, manager.token, "PATCH", { message: "Encaminhamos à equipe responsável.", assigneeId: randomUUID() }, [400]);
    let ticket = (await api("manager-assign-and-start", path, manager.token, "PATCH", { message: "A equipe iniciou a análise da solicitação.", assigneeId: manager.id, status: "IN_PROGRESS" })).ticket;
    const first = ticket.firstResponseAt;
    check("support-first-response-and-assignment", !!first && ticket.assigneeId === manager.id && ticket.status === "IN_PROGRESS" && ticket.dueAt === chosen!.dueAt);
    ticket = (await api("manager-escalate", path, manager.token, "PATCH", { message: "Encaminhamos para análise especializada.", status: "ESCALATED" })).ticket;
    check("support-first-response-immutable", ticket.firstResponseAt === first && ticket.status === "ESCALATED");
    ticket = (await api("manager-resolve", path, manager.token, "PATCH", { message: "A orientação foi prestada e o atendimento concluído.", status: "RESOLVED" })).ticket;
    check("support-resolved-timestamp", !!ticket.resolvedAt && ticket.status === "RESOLVED");
    await api("manager-cannot-rate-another-requester", path, manager.token, "PATCH", { message: "Avaliação do atendimento.", rating: 5 }, [409]);
    await api("invalid-ticket-rating-denied", path, learner.token, "PATCH", { message: "Avaliação do atendimento.", rating: 6 }, [400]);
    ticket = (await api("requester-rate-resolved-ticket", path, learner.token, "PATCH", { message: "A orientação esclareceu a solicitação.", rating: 5 })).ticket;
    check("ticket-rating-persisted", ticket.rating === 5 && ticket.history.at(-1).actor === learner.id);
    await api("resolved-cannot-skip-reopen", path, manager.token, "PATCH", { message: "Nova análise da solicitação.", status: "IN_PROGRESS" }, [409]);
    ticket = (await api("manager-reopen-ticket", path, manager.token, "PATCH", { message: "Reabertura para esclarecer uma questão complementar.", status: "OPEN" })).ticket;
    check("reopen-clears-rating-and-resolution", ticket.rating === null && ticket.resolvedAt === null && ticket.firstResponseAt === first);
    await api("reopened-ticket-rating-denied", path, learner.token, "PATCH", { message: "Avaliação do atendimento.", rating: 1 }, [409]);
    await api("manager-close-again", path, manager.token, "PATCH", { message: "Questão complementar esclarecida.", status: "RESOLVED" });
    await api("requester-rates-new-closure", path, learner.token, "PATCH", { message: "Atendimento concluído com os esclarecimentos.", rating: 4 });
    const stored = await sql(`SELECT status,rating,history,first_response_at FROM operation_ticket WHERE id=$1`, [id]);
    check("support-final-sql-state-and-history", stored[0].status === "RESOLVED" && stored[0].rating === 4 && stored[0].history.length === 9 && new Date(stored[0].first_response_at).toISOString() === first);
  });
}

async function cleanup() {
  const allowed = new Set(["department:id", "app_user:id", "operation_course:id", "operation_ticket:id", "operation_progress:id", "user_role:user_id", "user_profile:user_id", "user_department:user_id"]);
  if (journal.entries.some(e => !allowed.has(`${e.table}:${e.key}`) || !/^[0-9a-f-]{36}$/i.test(e.id))) throw new Error("UNKNOWN_OWNERSHIP");
  const users = journal.entries.filter(e => e.table === "app_user").map(e => e.id);
  const courses = journal.entries.filter(e => e.table === "operation_course").map(e => e.id);
  for (const id of users) {
    const rows = await sql(`SELECT firebase_uid FROM app_user WHERE id=$1`, [id]);
    if (rows[0]?.firebase_uid && !journal.users.some(u => u.id === id && u.uid === rows[0].firebase_uid)) journal.users.push({ id, uid: rows[0].firebase_uid });
    for (const table of ["user_role", "user_profile", "user_department"]) own(table, id, "user_id");
    // Negative assessment/lesson calls can create progress before rejecting the operation.
    for (const course of courses) for (const row of await sql(`SELECT id FROM operation_progress WHERE user_id=$1 AND course_id=$2`, [id, course])) own("operation_progress", row.id);
  }
  if (journal.users.some(u => u.uid === existingAdminUid || !users.includes(u.id))) throw new Error("UNKNOWN_OWNERSHIP");
  save();
  const snapshot: Row[] = [];
  for (const e of journal.entries) {
    const rows = await sql(`SELECT * FROM "${e.table}" WHERE "${e.key}"=$1`, [e.id]);
    if (rows.length) snapshot.push({ scope: e, rows });
  }
  if (snapshot.length) {
    const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(snapshot), "utf8"), cipher.final()]);
    const stamp = randomUUID();
    writeFileSync(join(dir, `history-${stamp}.key`), key, { mode: 0o600 });
    writeFileSync(join(dir, `history-${stamp}.aes`), Buffer.concat([iv, cipher.getAuthTag(), data]), { mode: 0o600 });
  }
  const order = ["operation_progress", "operation_ticket", "operation_course", "user_role", "user_profile", "user_department", "app_user", "department"];
  const entries = [...journal.entries].sort((a,b) => order.indexOf(a.table)-order.indexOf(b.table));
  // audit_log is intentionally retained. All DELETEs are exact journal IDs / own user FKs.
  if (entries.length) await sql.transaction([sql(`SET LOCAL lock_timeout='10s'`), ...entries.map(e => sql(`DELETE FROM "${e.table}" WHERE "${e.key}"=$1`, [e.id]))]);
  check("sql-owned-resources-cleaned", true);
  for (const u of journal.users) { try { await auth.deleteUser(u.uid); } catch(e) { if ((e as {code?:string}).code !== "auth/user-not-found") throw e; } }
  check("firebase-owned-accounts-cleaned", true);
  for (const e of entries) check("sql-cleanup-confirmed-zero", (await sql(`SELECT 1 FROM "${e.table}" WHERE "${e.key}"=$1 LIMIT 1`, [e.id])).length === 0);
  for (const u of journal.users) {
    let absent = false;
    try { await auth.getUser(u.uid); } catch(e) { if ((e as {code?:string}).code === "auth/user-not-found") absent = true; else throw e; }
    check("firebase-cleanup-confirmed-absent", absent);
  }
  check("no-ambiguous-requests", journal.pending.length === 0);
  journal.cleanupComplete = true; save();
}
async function quarantine() {
  for (const u of journal.users) {
    if (u.uid === existingAdminUid || !journal.entries.some(e => e.table === "app_user" && e.id === u.id)) continue;
    try { if ((await sql(`SELECT id FROM app_user WHERE id=$1 AND firebase_uid=$2`, [u.id,u.uid])).length) { await auth.updateUser(u.uid,{disabled:true}); await auth.revokeRefreshTokens(u.uid); } } catch(e) { fail("own-account-quarantine-pending", e); }
  }
}
async function run() {
  save();
  try { await main(); } catch(e) { fail("setup-or-execution",e); }
  finally { try { await cleanup(); } catch(e) { fail("cleanup-pending-recovery",e); await quarantine(); } save(); }
  console.log(`Private evidence: ${dir}`);
  console.log(JSON.stringify({ pass: evidence.filter(e=>e.outcome==="PASS").length, fail: evidence.filter(e=>e.outcome==="FAIL").length, cleanupComplete:journal.cleanupComplete }));
  process.exitCode=evidence.some(e=>e.outcome==="FAIL")?1:0;
}
void run().catch(e=>{console.error(safeError(e));process.exitCode=1;});
