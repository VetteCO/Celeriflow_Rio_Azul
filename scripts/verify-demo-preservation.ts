/** Read-only comparison of every pre-existing row and original attachment. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client, neonConfig, types } from "@neondatabase/serverless";
import { downloadAttachment } from "../src/lib/blob";

type Row = Record<string, any>;
function canonical(value: any): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return JSON.stringify(new Date(value).toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function main() {
  const index = process.argv.indexOf("--directory"); assert.ok(index >= 0 && process.argv[index + 1]);
  const directory = resolve(process.argv[index + 1]), root = resolve(process.env.LOCALAPPDATA!, "Temp/opencode");
  assert.ok(directory.startsWith(root + "\\") || directory.startsWith(root + "/"));
  const baseline: Record<string, Row[]> = JSON.parse(readFileSync(join(directory, "baseline/snapshot.private.json"), "utf8"));
  const summary = JSON.parse(readFileSync(join(directory, "baseline/snapshot-summary.json"), "utf8"));
  assert.equal(summary.database, createHash("sha256").update(process.env.DATABASE_URL!).digest("hex"));
  neonConfig.webSocketConstructor = WebSocket;
  // Match the original snapshot's Drizzle timestamp parsers, retaining SQL microseconds.
  for (const oid of [1082, 1114, 1184]) types.setTypeParser(oid, (value: string) => value);
  const client = new Client({ connectionString: process.env.DIRECT_URL }); await client.connect();
  const tables: Row[] = [], failures: Row[] = [], expectedChanges: Row[] = [];
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const keys = (await client.query(`SELECT tc.table_name,kcu.column_name FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.constraint_schema=tc.constraint_schema AND kcu.table_name=tc.table_name
      WHERE tc.table_schema='public' AND tc.constraint_type='PRIMARY KEY' ORDER BY tc.table_name,kcu.ordinal_position`)).rows;
    for (const [table, before] of Object.entries(baseline)) {
      const primary = keys.filter(k => k.table_name === table).map(k => k.column_name);
      const identify = (row: Row) => primary.length ? canonical(primary.map(column => row[column])) : canonical(row);
      const current = (await client.query(`SELECT * FROM "${table.replaceAll('"', '""')}"`)).rows;
      const map = new Map(current.map(row => [identify(row), row]));
      const multiplicity = new Map<string, number>();
      for (const row of current) multiplicity.set(identify(row), (multiplicity.get(identify(row)) ?? 0) + 1);
      let modified = 0, missing = 0;
      for (const original of before) {
        const row = map.get(identify(original));
        if (!row || !multiplicity.get(identify(original))) { missing++; continue; }
        multiplicity.set(identify(original), multiplicity.get(identify(original))! - 1);
        const columns = Object.keys(original).filter(column => canonical(original[column]) !== canonical(row[column]));
        if (!columns.length) continue;
        if (table === "business_counter" && columns.every(column => column === "value") && BigInt(row.value) >= BigInt(original.value)) expectedChanges.push({ table, columns, reason: "Business code allocation advanced monotonically." });
        else if (table === "user_profile" && columns.every(column => column === "last_access_at") && row.last_access_at && (!original.last_access_at || new Date(row.last_access_at).valueOf() >= new Date(original.last_access_at).valueOf())) expectedChanges.push({ table, columns, reason: "Authenticated access updated the last-access timestamp; original profile fields are unchanged." });
        else { modified++; failures.push({ table, columns }); }
      }
      tables.push({ table, originalRows: before.length, currentRows: current.length, missing, modified });
    }
    await client.query("COMMIT");
  } finally { await client.end(); }
  const attachments = [];
  for (const original of summary.originals) {
    const file = baseline.attachment.find(row => row.id === original.id); assert.ok(file);
    const stored = await downloadAttachment(file.storage_key); assert.ok(stored);
    const bytes = Buffer.from(await new Response(stored.stream).arrayBuffer());
    const preserved = bytes.length === original.actualBytes && createHash("sha256").update(bytes).digest("hex") === original.sha256;
    attachments.push({ preserved, actualBytes: bytes.length });
  }
  const preserved = tables.every(t => t.missing === 0 && t.modified === 0) && attachments.every(a => a.preserved);
  const report = { at: new Date().toISOString(), preserved, tables, expectedChanges, failures, attachments };
  writeFileSync(join(directory, "preservation.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ preserved, tables: tables.length, originalRows: tables.reduce((sum, t) => sum + t.originalRows, 0), missing: tables.reduce((sum, t) => sum + t.missing, 0), modified: tables.reduce((sum, t) => sum + t.modified, 0), expectedOperationalChanges: expectedChanges.length, originalAttachments: attachments.length }));
  assert.ok(preserved, "Confira preservation.json");
}
void main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : "Falha na conferência de preservação; consulte o relatório privado."); process.exitCode = 1; });
