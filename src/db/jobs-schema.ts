import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { appUser } from "./schema";
import type { JobPayload } from "@/lib/jobs/types";

export const documentJob = pgTable("document_job", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().default(sql`jobs_next_code()`),
  ownerId: uuid("owner_id").notNull().references(() => appUser.id),
  assigneeId: uuid("assignee_id").references(() => appUser.id),
  kind: text("kind").notNull(), status: text("status").notNull().default("QUEUED"),
  idempotencyKey: text("idempotency_key").notNull(), requestHash: text("request_hash").notNull(),
  payload: jsonb("payload").$type<JobPayload>().notNull(),
  attempts: integer("attempts").notNull().default(0), maxAttempts: integer("max_attempts").notNull().default(3),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  leaseToken: uuid("lease_token"), leaseUntil: timestamp("lease_until", { withTimezone: true }),
  error: text("error"), outputKey: text("output_key"), outputType: text("output_type"), outputHash: text("output_hash"),
  outputSize: integer("output_size"), outputName: text("output_name"),
  validation: jsonb("validation").$type<Record<string, unknown>>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({ code: uniqueIndex("document_job_code_uq").on(t.code), key: uniqueIndex("document_job_key_uq").on(t.ownerId, t.idempotencyKey) }));
export const documentJobText = pgTable("document_job_text", {
  id: uuid("id").primaryKey().defaultRandom(), jobId: uuid("job_id").notNull().references(() => documentJob.id),
  fileId: uuid("file_id").notNull(), sourceId: uuid("source_id").notNull(), text: text("text").notNull(),
}, t => ({ file: uniqueIndex("document_job_text_file_uq").on(t.jobId, t.fileId) }));
export type DocumentJob = typeof documentJob.$inferSelect;
