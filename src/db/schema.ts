import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex
} from "drizzle-orm/pg-core";

// Enums extensíveis (pós-POC: adicionar tipos sem quebrar POC)
export const documentTypeEnum = pgEnum("document_type", [
  "MEMORANDUM",
  "OFICIO",
  "CIRCULAR",
  "EXTERNAL_REQUEST",
  "DISPATCH",
  "OTHER"
]);

export const documentStatusEnum = pgEnum("document_status", [
  "DRAFT",
  "OPEN",
  "IN_TRANSIT",
  "CONCLUDED",
  "ARCHIVED"
]);

export const emailDirectionEnum = pgEnum("email_direction", [
  "OUTBOUND",
  "INBOUND"
]);

export const organization = pgTable("organization", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cnpj: text("cnpj")
});

export const department = pgTable("department", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  acronym: text("acronym"),
  active: boolean("active").notNull().default(true)
});

export const appUser = pgTable("app_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cpf: text("cpf"),
  email: text("email").notNull().unique(),
  firebaseUid: text("firebase_uid").unique(),
  externalAuthId: text("external_auth_id"),
  departmentId: uuid("department_id").references(() => department.id),
  active: boolean("active").notNull().default(true)
});

export const role = pgTable("role", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique() // ADMIN_GERAL, NIVEL_3_VISUALIZACAO
});

export const permission = pgTable("permission", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique() // doc:create, doc:edit, doc:forward, doc:sign, admin:users
});

export const userRole = pgTable("user_role", {
  userId: uuid("user_id")
    .notNull()
    .references(() => appUser.id),
  roleId: uuid("role_id")
    .notNull()
    .references(() => role.id)
});

export const citizen = pgTable("citizen", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cpfCnpj: text("cpf_cnpj").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  cep: text("cep"),
  street: text("street"),
  number: text("number"),
  complement: text("complement"),
  district: text("district"),
  city: text("city"),
  state: text("state")
});

export const document = pgTable("document", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessCode: text("business_code").unique(),
  type: documentTypeEnum("type").notNull(),
  number: integer("number").notNull(),
  year: integer("year").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull().default(""),
  status: documentStatusEnum("status").notNull().default("DRAFT"),
  accessLevel: text("access_level").notNull().default("INTERNAL"),
  originDepartmentId: uuid("origin_department_id").references(
    () => department.id
  ),
  createdById: uuid("created_by_id").references(() => appUser.id),
  // Só usado em CIRCULAR: URGENT | INFORMATIVE
  urgency: text("urgency"),
  publicKey: text("public_key").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow()
},
(t) => ({
  // Numeração sequencial por tipo+ano (ex. MEM-000001/2026). O unique
  // garante que nunca duplica mesmo com criação concorrente.
  typeYearNumberUnique: uniqueIndex("document_type_year_number_unique").on(
    t.type,
    t.year,
    t.number
  )
}));

export const documentDeadline = pgTable("document_deadline", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => document.id),
  title: text("title").notNull(),
  dueAt: timestamp("due_at").notNull(),
  status: text("status").notNull().default("PENDING")
});

export const documentRecipient = pgTable("document_recipient", {
  documentId: uuid("document_id")
    .notNull()
    .references(() => document.id),
  departmentId: uuid("department_id").references(() => department.id),
  userId: uuid("user_id").references(() => appUser.id),
  recipientType: text("recipient_type").notNull().default("TO")
});

export const documentReadReceipt = pgTable(
  "document_read_receipt",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id),
    // Imutável: só INSERT (onConflictDoNothing). Nunca UPDATE.
    firstReadAt: timestamp("first_read_at").notNull().defaultNow(),
    lastReadAt: timestamp("last_read_at")
  },
  (t) => ({
    docUserUnique: uniqueIndex("read_receipt_doc_user_unique").on(t.documentId, t.userId)
  })
);

export const documentMovement = pgTable("document_movement", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => document.id),
  fromDepartmentId: uuid("from_department_id").references(
    () => department.id
  ),
  toDepartmentId: uuid("to_department_id").references(() => department.id),
  action: text("action").notNull(), // CREATED, SENT, RECEIVED, READ, FORWARDED, SIGNED, CONCLUDED
  note: text("note"),
  visibility: text("visibility").notNull().default("INTERNAL"),
  actorUserId: uuid("actor_user_id").references(() => appUser.id),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const attachment = pgTable("attachment", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => document.id),
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  storageKey: text("storage_key").notNull(), // URL do Vercel Blob
  size: integer("size"),
  citizenVisible: boolean("citizen_visible").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const externalRequest = pgTable("external_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  citizenId: uuid("citizen_id")
    .notNull()
    .references(() => citizen.id),
  documentId: uuid("document_id")
    .notNull()
    .references(() => document.id),
  protocolNumber: text("protocol_number").notNull().unique(),
  publicKey: text("public_key").notNull().unique(),
  requestType: text("request_type"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const emailMessage = pgTable("email_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => document.id),
  direction: emailDirectionEnum("direction").notNull(),
  providerMessageId: text("provider_message_id").unique(),
  from: text("from_addr").notNull(),
  to: text("to_addr").notNull(),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  replyToken: text("reply_token").unique(),
  status: text("status").notNull().default("PENDING"),
  sentAt: timestamp("sent_at"),
  receivedAt: timestamp("received_at")
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const userDepartment = pgTable("user_department", {
  userId: uuid("user_id").notNull().references(() => appUser.id),
  departmentId: uuid("department_id").notNull().references(() => department.id),
}, (t) => ({ unique: uniqueIndex("user_department_unique").on(t.userId, t.departmentId) }));

export const documentParticipation = pgTable("document_participation", {
  documentId: uuid("document_id").notNull().references(() => document.id),
  departmentId: uuid("department_id").notNull().references(() => department.id),
  state: text("state").notNull().default("PENDING"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ unique: uniqueIndex("document_participation_unique").on(t.documentId, t.departmentId) }));

export const businessCounter = pgTable("business_counter", {
  key: text("key").primaryKey(),
  value: integer("value").notNull(),
});

export const userProfile = pgTable("user_profile", {
  userId: uuid("user_id").primaryKey().references(() => appUser.id),
  phone: text("phone"),
  registration: text("registration"),
  position: text("position"),
  preferences: jsonb("preferences"),
  leaveStart: timestamp("leave_start"),
  leaveEnd: timestamp("leave_end"),
  lastAccessAt: timestamp("last_access_at"),
});

export const calendarHoliday = pgTable("calendar_holiday", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: text("date").notNull().unique(),
  title: text("title").notNull(),
});

export const citizenIdentity = pgTable("citizen_identity", {
  cpfCnpj: text("cpf_cnpj").primaryKey(),
  citizenId: uuid("citizen_id").notNull().references(() => citizen.id),
});
