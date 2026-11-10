import { sql } from "drizzle-orm";
import { db } from "@/db";
import { document, documentDeadline, documentMovement, documentParticipation, documentRecipient, auditLog, citizen, citizenIdentity, externalRequest, emailMessage } from "@/db/schema";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";
import sanitizeHtml from "sanitize-html";
import { coreWriteGuard, coreWriteLock } from "./core-write-guard";

export type DocumentType = typeof document.$inferInsert.type;
const PREFIX: Record<DocumentType, string> = { MEMORANDUM: "MEM", OFICIO: "OFI", CIRCULAR: "CIR", EXTERNAL_REQUEST: "REQ", DISPATCH: "DES", OTHER: "DOC" };
export function formatNumber(type: DocumentType, number: number, year: number, businessCode?: string | null) {
  return businessCode ?? `${PREFIX[type]}-${String(number).padStart(6, "0")}/${year}`;
}
export async function nextBusinessCode() {
  const day = businessDay(new Date());
  const result = await db.execute(sql`INSERT INTO business_counter(key,value) VALUES (${`business:${day}`},1) ON CONFLICT(key) DO UPDATE SET value=business_counter.value+1 WHERE business_counter.value < 99999 RETURNING value`);
  const row = result.rows[0] as { value: number } | undefined;
  if (!row) throw new Error("daily_business_code_exhausted");
  return `${day}${String(row.value).padStart(5, "0")}`;
}
export const nextProtocolNumber = nextBusinessCode;
export function businessDay(date: Date) {
  if (!Number.isFinite(date.getTime())) throw new Error("invalid_business_date");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replace(/-/g, "");
}

// Preserve editor formatting while rejecting executable markup and unsafe URLs.
export function sanitizeDocumentHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "u", "s"],
    allowedAttributes: { "*": ["style"], a: ["href", "title"], img: ["src", "alt", "width", "height"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan", "scope"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/], "font-weight": [/^(bold|normal|[1-9]00)$/], "font-style": [/^(italic|normal)$/], "text-decoration": [/^(underline|line-through|none)$/] } },
  });
}

export async function createDocumentWithNumber(opts: {
  type: DocumentType; subject: string; body: string; originDepartmentId: string | null; createdById: string | null;
  toDepartmentId?: string | null; departmentIds?: string[]; recipientUsers?: { id: string; departmentId: string | null }[];
  urgency?: string; accessLevel?: string; deadlines?: { title: string; dueAt: string }[];
  external?: { person: typeof citizen.$inferInsert & { id: string }; existing: boolean; requestType: string };
}) {
  const now = new Date();
  const day = businessDay(now);
  const year = Number(day.slice(0, 4));
  const businessKey = `business:${day}`, documentKey = `${opts.type}:${year}`;
  const businessCode = sql<string>`${day} || lpad((SELECT value::text FROM business_counter WHERE key=${businessKey}),5,'0')`;
  const number = sql<number>`(SELECT value FROM business_counter WHERE key=${documentKey})`;
  const id = randomUUID();
  const publicKey = nanoid(32);
  const targets = Array.from(new Set([opts.toDepartmentId, ...(opts.departmentIds ?? [])].filter((x): x is string => !!x)));
  const departments = Array.from(new Set([opts.originDepartmentId, ...targets].filter((x): x is string => !!x)));
  // Counters and every dependent row share a transaction. A rejected insert does
  // not reserve a number or leave a partial document. One lock order for all types.
  const authorization = opts.createdById ? [coreWriteGuard(opts.createdById, "doc:create", null, opts.originDepartmentId)] : [];
  const results = await db.batch([
    coreWriteLock(),
    ...authorization,
    db.execute(sql`SELECT pg_advisory_xact_lock(20261110, 42)`),
    db.execute(sql`WITH allocated AS (INSERT INTO business_counter(key,value) VALUES(${businessKey},1) ON CONFLICT(key) DO UPDATE SET value=business_counter.value+1 WHERE business_counter.value<99999 RETURNING value) SELECT 1/count(*)::int FROM allocated`),
    db.execute(sql`INSERT INTO business_counter(key,value) SELECT ${documentKey},coalesce(max(number),0)+1 FROM document WHERE type=${opts.type} AND year=${year} ON CONFLICT(key) DO UPDATE SET value=greatest(business_counter.value,(SELECT coalesce(max(number),0) FROM document WHERE type=${opts.type} AND year=${year}))+1`),
    db.insert(document).values({ id, businessCode, type: opts.type, number, year, subject: opts.subject, body: sanitizeDocumentHtml(opts.body), status: "OPEN", originDepartmentId: opts.originDepartmentId, createdById: opts.createdById, publicKey, urgency: opts.urgency, accessLevel: opts.accessLevel ?? "INTERNAL" }).returning(),
    ...departments.map(departmentId => db.insert(documentParticipation).values({ documentId: id, departmentId, state: targets.includes(departmentId) ? "PENDING" : "OPEN" })),
    ...(opts.deadlines ?? []).map(d => db.insert(documentDeadline).values({ documentId: id, title: d.title, dueAt: new Date(d.dueAt) })),
    ...(opts.recipientUsers ?? []).map(u => db.insert(documentRecipient).values({ documentId: id, departmentId: u.departmentId, userId: u.id })),
    ...(targets.length ? targets : [null]).map(toDepartmentId => db.insert(documentMovement).values({ documentId: id, fromDepartmentId: opts.originDepartmentId, toDepartmentId, actorUserId: opts.createdById, action: "CREATED" })),
    db.insert(auditLog).values({ actorType: opts.createdById ? "USER" : "CITIZEN", actorId: opts.createdById, action: "DOCUMENT_CREATED", entityType: "document", entityId: id, metadata: sql`jsonb_build_object('businessCode',${businessCode})` }),
    ...(opts.external && !opts.external.existing ? [db.insert(citizen).values(opts.external.person)] : []),
    ...(opts.external && !opts.external.existing ? [db.insert(citizenIdentity).values({ cpfCnpj: opts.external.person.cpfCnpj, citizenId: opts.external.person.id })] : []),
    ...(opts.external ? [db.insert(externalRequest).values({ citizenId: opts.external.person.id, documentId: id, protocolNumber: businessCode, publicKey, requestType: opts.external.requestType }), db.insert(emailMessage).values({ documentId: id, direction: "OUTBOUND", from: process.env.EMAIL_FROM ?? "pendente@configurar", to: opts.external.person.email, subject: sql`'Protocolo ' || ${businessCode} || ' recebido'`, bodyText: sql`'Protocolo ' || ${businessCode} || '. Chave: ' || ${publicKey}::text`, replyToken: nanoid(32), status: "PENDING" })] : []),
  ]);
  const created = results[authorization.length + 4] as (typeof document.$inferSelect)[];
  return created[0]!;
}
