import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, uniqueIndex, bigint, bigserial, primaryKey } from "drizzle-orm/pg-core";
import { appUser,document,department } from "./schema";
export type Lesson = { title: string; videoUrl: string; content: string };
export type Question = { prompt: string; options: string[]; answer: number };
const code = () => text("code").notNull().unique().default(sql`operations_next_code()`);
export const operationCourse = pgTable("operation_course", {
  id: uuid("id").primaryKey().defaultRandom(), code: code(), title: text("title").notNull(), module: text("module").notNull(),
  createdById: uuid("created_by_id").references(() => appUser.id).notNull(),
  lessons: jsonb("lessons").$type<Lesson[]>().notNull(), questions: jsonb("questions").$type<Question[]>().notNull(),
  passScore: integer("pass_score").notNull().default(70), published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const operationProgress = pgTable("operation_progress", {
  id: uuid("id").primaryKey().defaultRandom(), courseId: uuid("course_id").references(() => operationCourse.id).notNull(),
  userId: uuid("user_id").references(() => appUser.id).notNull(), completed: integer("completed").notNull().default(0),
  score: integer("score"), certificateCode: text("certificate_code").unique(), certifiedAt: timestamp("certified_at", { withTimezone: true }),
}, t => ({ unique: uniqueIndex("operation_progress_user_course").on(t.userId, t.courseId) }));
export type TicketEvent = { at: string; actor: string; message: string; status: string; assignee: string | null };
export const operationTicket = pgTable("operation_ticket", {
  id: uuid("id").primaryKey().defaultRandom(), code: code(), requesterId: uuid("requester_id").references(() => appUser.id).notNull(),
  subject: text("subject").notNull(), severity: text("severity").notNull(), status: text("status").notNull().default("OPEN"),
  assigneeId: uuid("assignee_id").references(() => appUser.id), history: jsonb("history").$type<TicketEvent[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }), firstResponseAt: timestamp("first_response_at", { withTimezone: true }), rating: integer("rating"),
});
export const operationReport = pgTable("operation_report", {
  id: uuid("id").primaryKey().defaultRandom(), code: code(), createdById: uuid("created_by_id").references(() => appUser.id).notNull(),
  period: text("period").notNull(), requestKey: text("request_key").notNull().unique(),
  snapshot: jsonb("snapshot").$type<{ filters: Record<string,string>; rows: {id:string;category:string;indicator:string;value:number;unit:string;source:string}[]; generatedAt:string }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone:true }).defaultNow().notNull(),
});
export const operationReportJob=pgTable('operation_report_job',{
 id:uuid('id').primaryKey().defaultRandom(),ownerId:uuid('owner_id').notNull().references(()=>appUser.id),requestKey:text('request_key').notNull(),
 filters:jsonb('filters').$type<Record<string,string>>().notNull(),format:text('format').notNull(),status:text('status').notNull().default('QUEUED'),attempts:integer('attempts').notNull().default(0),
 leaseToken:uuid('lease_token'),leaseUntil:timestamp('lease_until',{withTimezone:true}),snapshot:jsonb('snapshot').$type<Record<string,unknown>>(),outputKey:text('output_key'),outputHash:text('output_hash'),outputSize:bigint('output_size',{mode:'number'}),error:text('error'),
 createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),completedAt:timestamp('completed_at',{withTimezone:true}),expiresAt:timestamp('expires_at',{withTimezone:true}),notifiedAt:timestamp('notified_at',{withTimezone:true}),
},t=>({request:uniqueIndex('operation_report_job_owner_id_request_key_key').on(t.ownerId,t.requestKey)}));
export const operationPageMetric=pgTable('operation_page_metric',{
 sourceType:text('source_type').notNull(),sourceId:uuid('source_id').notNull(),storageKey:text('storage_key').notNull(),sourceHash:text('source_hash').notNull().default(''),contentHash:text('content_hash'),pages:integer('pages'),bytes:bigint('bytes',{mode:'number'}),status:text('status').notNull(),measuredAt:timestamp('measured_at',{withTimezone:true}).notNull().defaultNow(),detail:text('detail'),
},t=>({pk:primaryKey({columns:[t.sourceType,t.sourceId,t.storageKey,t.sourceHash]})}));
export const operationParticipationHistory=pgTable('operation_participation_history',{
 id:bigserial('id',{mode:'number'}).primaryKey(),documentId:uuid('document_id').notNull().references(()=>document.id),departmentId:uuid('department_id').notNull().references(()=>department.id),state:text('state').notNull(),recordedAt:timestamp('recorded_at',{withTimezone:true}).notNull().defaultNow(),origin:text('origin').notNull(),
});
