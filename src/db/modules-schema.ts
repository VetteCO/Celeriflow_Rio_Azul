import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, uniqueIndex, boolean, primaryKey } from "drizzle-orm/pg-core";
import { appUser, department } from "./schema";
import type { ModuleData } from "@/lib/modules/domain";

// Kept separate from the core schema: deploy 002_modules.sql explicitly.
export const moduleRecord = pgTable("module_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().default(sql`modules_next_code()`),
  family: text("family").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("RASCUNHO"),
  revision: integer("revision").notNull().default(1),
  departmentId: uuid("department_id").references(() => department.id),
  ownerId: uuid("owner_id").references(() => appUser.id),
  actorId: uuid("actor_id").references(() => appUser.id),
  externalOwnerUid: text("external_owner_uid"),
  externalOwnerEmail: text("external_owner_email"),
  externalActorUid: text("external_actor_uid"),
  access: text("access").notNull().default("SETOR"),
  participants: jsonb("participants").$type<string[]>().notNull().default([]),
  data: jsonb("data").$type<ModuleData>().notNull().default({}),
  action: text("action").notNull().default("CRIADO"),
  note: text("note").notNull().default(""),
  publicKey: uuid("public_key").notNull().defaultRandom(),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({ code: uniqueIndex("module_record_code_uq").on(t.code), publicKey: uniqueIndex("module_record_key_uq").on(t.publicKey), idempotency: uniqueIndex("module_record_idempotency_uq").on(t.ownerId, t.idempotencyKey), externalIdempotency: uniqueIndex("module_external_idempotency_uq").on(t.externalOwnerUid, t.idempotencyKey) }));

export const moduleVersion = pgTable("module_version", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordId: uuid("record_id").notNull().references(() => moduleRecord.id),
  revision: integer("revision").notNull(),
  actorId: uuid("actor_id").references(() => appUser.id),
  action: text("action").notNull(),
  note: text("note").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({ revision: uniqueIndex("module_version_revision_uq").on(t.recordId, t.revision) }));

export const moduleFile = pgTable("module_file", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordId: uuid("record_id").notNull().references(() => moduleRecord.id),
  actorId: uuid("actor_id").references(() => appUser.id),
  externalActorUid: text("external_actor_uid"),
  externalVisible: boolean("external_visible").notNull().default(false),
  filename: text("filename").notNull(),
  category: text("category").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ModuleRecord = typeof moduleRecord.$inferSelect;
export const moduleEditLease = pgTable("module_edit_lease", {
 recordId: uuid("record_id").primaryKey().references(()=>moduleRecord.id), actorId:uuid("actor_id").notNull().references(()=>appUser.id), tokenHash:text("token_hash").notNull(), expiresAt:timestamp("expires_at",{withTimezone:true}).notNull(),
});
export const moduleAnonymousAccess = pgTable("module_anonymous_access", {
 recordId:uuid("record_id").primaryKey().references(()=>moduleRecord.id),tokenHash:text("token_hash").notNull().unique(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
export const moduleSectorTag = pgTable("module_sector_tag", {
 recordId:uuid("record_id").notNull().references(()=>moduleRecord.id),departmentId:uuid("department_id").notNull().references(()=>department.id),label:text("label").notNull(),actorId:uuid("actor_id").notNull().references(()=>appUser.id),
},t=>({pk:primaryKey({columns:[t.recordId,t.departmentId,t.label]})}));
export const modulePasscode = pgTable("module_passcode", {
 id:uuid("id").primaryKey().defaultRandom(),recordId:uuid("record_id").notNull().references(()=>moduleRecord.id),issuerId:uuid("issuer_id").notNull().references(()=>appUser.id),recipientId:uuid("recipient_id").notNull().references(()=>appUser.id),tokenHash:text("token_hash").notNull().unique(),expiresAt:timestamp("expires_at",{withTimezone:true}).notNull(),usedAt:timestamp("used_at",{withTimezone:true}),cancelledAt:timestamp("cancelled_at",{withTimezone:true}),
});

export const moduleMandate = pgTable("module_mandate", {
  id: uuid("id").primaryKey().defaultRandom(), code: text("code").notNull().unique().default(sql`modules_next_code()`),
  principalUid: text("principal_uid").notNull(), principalEmail: text("principal_email").notNull(),
  representativeEmail: text("representative_email").notNull(), representativeUid: text("representative_uid"),
  families: jsonb("families").$type<string[]>().notNull(), recordIds: jsonb("record_ids").$type<string[]>().notNull().default([]),
  permissions: jsonb("permissions").$type<string[]>().notNull(), consent: text("consent").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }), revokedAt: timestamp("revoked_at", { withTimezone: true }),
  actorUid: text("actor_uid").notNull(), revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
