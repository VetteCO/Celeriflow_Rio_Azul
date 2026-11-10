import { sql } from "drizzle-orm";
import { db } from "@/db";
import { document, documentDeadline, documentMovement, documentParticipation, documentRecipient, auditLog, citizen, citizenIdentity, externalRequest, emailMessage } from "@/db/schema";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";
import sanitizeHtml from "sanitize-html";

export type DocumentType = typeof document.$inferInsert.type;
const PREFIX: Record<DocumentType, string> = { MEMORANDUM: "MEM", OFICIO: "OFI", CIRCULAR: "CIR", EXTERNAL_REQUEST: "REQ", DISPATCH: "DES", OTHER: "DOC" };
export function formatNumber(type: DocumentType, number: number, year: number, businessCode?: string | null) {
  return businessCode ?? `${PREFIX[type]}-${String(number).padStart(6, "0")}/${year}`;
}
export async function nextBusinessCode() {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
  const result = await db.execute(sql`INSERT INTO business_counter(key,value) VALUES (${`business:${day}`},1) ON CONFLICT(key) DO UPDATE SET value=business_counter.value+1 WHERE business_counter.value < 99999 RETURNING value`);
  const row = result.rows[0] as { value: number } | undefined;
  if (!row) throw new Error("daily_business_code_exhausted");
  return `${day}${String(row.value).padStart(5, "0")}`;
}
export const nextProtocolNumber = nextBusinessCode;

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
  const businessCode = await nextBusinessCode();
  const year = Number(businessCode.slice(0, 4));
  const counter = await db.execute(sql`INSERT INTO business_counter(key,value) SELECT ${`${opts.type}:${year}`}, coalesce(max(number),0)+1 FROM document WHERE type=${opts.type} AND year=${year} ON CONFLICT(key) DO UPDATE SET value=business_counter.value+1 RETURNING value`);
  const number = Number(counter.rows[0].value);
  const id = randomUUID();
  const publicKey = nanoid(32);
  const targets = Array.from(new Set([opts.toDepartmentId, ...(opts.departmentIds ?? [])].filter((x): x is string => !!x)));
  const departments = Array.from(new Set([opts.originDepartmentId, ...targets].filter((x): x is string => !!x)));
  const [created] = await db.batch([
    db.insert(document).values({ id, businessCode, type: opts.type, number, year, subject: opts.subject, body: sanitizeDocumentHtml(opts.body), status: "OPEN", originDepartmentId: opts.originDepartmentId, createdById: opts.createdById, publicKey, urgency: opts.urgency, accessLevel: opts.accessLevel ?? "INTERNAL" }).returning(),
    ...departments.map(departmentId => db.insert(documentParticipation).values({ documentId: id, departmentId, state: targets.includes(departmentId) ? "PENDING" : "OPEN" })),
    ...(opts.deadlines ?? []).map(d => db.insert(documentDeadline).values({ documentId: id, title: d.title, dueAt: new Date(d.dueAt) })),
    ...(opts.recipientUsers ?? []).map(u => db.insert(documentRecipient).values({ documentId: id, departmentId: u.departmentId, userId: u.id })),
    db.insert(documentMovement).values({ documentId: id, fromDepartmentId: opts.originDepartmentId, toDepartmentId: opts.toDepartmentId, actorUserId: opts.createdById, action: "CREATED" }),
    db.insert(auditLog).values({ actorType: opts.createdById ? "USER" : "CITIZEN", actorId: opts.createdById, action: "DOCUMENT_CREATED", entityType: "document", entityId: id, metadata: { businessCode } }),
    ...(opts.external && !opts.external.existing ? [db.insert(citizen).values(opts.external.person)] : []),
    ...(opts.external && !opts.external.existing ? [db.insert(citizenIdentity).values({ cpfCnpj: opts.external.person.cpfCnpj, citizenId: opts.external.person.id })] : []),
    ...(opts.external ? [db.insert(externalRequest).values({ citizenId: opts.external.person.id, documentId: id, protocolNumber: businessCode, publicKey, requestType: opts.external.requestType }), db.insert(emailMessage).values({ documentId: id, direction: "OUTBOUND", from: process.env.EMAIL_FROM ?? "pendente@configurar", to: opts.external.person.email, subject: `Protocolo ${businessCode} recebido`, bodyText: `Protocolo ${businessCode}. Chave: ${publicKey}`, replyToken: nanoid(32), status: "PENDING" })] : []),
  ]);
  return created[0]!;
}
