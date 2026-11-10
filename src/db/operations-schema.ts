import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { appUser } from "./schema";
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
