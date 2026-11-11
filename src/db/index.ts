import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { restoreRuntime } from "@/lib/restore-runtime";

restoreRuntime();

if (!process.env.DATABASE_URL) {
  // Não quebra build na Vercel sem env; falha só em runtime.
  console.warn("[db] DATABASE_URL ausente — configure no .env (CHECKPOINT 1)");
}

const sql = neon(process.env.DATABASE_URL ?? "postgresql://localhost:5432/postgres");
export const db = drizzle(sql, { schema });
