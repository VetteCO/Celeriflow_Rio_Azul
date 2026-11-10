import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/db/schema.ts", "./src/db/modules-schema.ts", "./src/db/operations-schema.ts", "./src/db/jobs-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // DIRECT_URL para migrate (sem pool). Fallback para DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true
});
