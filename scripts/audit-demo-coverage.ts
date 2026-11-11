/** Read-only inventory. No personal data, storage keys or credentials in its report. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client, neonConfig } from "@neondatabase/serverless";
import { families } from "../src/lib/modules/domain";

async function main() {
  const args = process.argv.slice(2), index = args.indexOf("--output");
  assert.ok(index >= 0 && args[index + 1], "Informe --output <arquivo>.");
  const output = resolve(args[index + 1]);
  const allowed = resolve(process.env.LOCALAPPDATA!, "Temp/opencode");
  assert.ok(output.startsWith(allowed + "\\") || output.startsWith(allowed + "/"));
  neonConfig.webSocketConstructor = WebSocket;
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const names = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows;
    const transient = new Set(["module_edit_lease", "module_passcode"]);
    const technical = new Set(["application_migration", "business_counter", "audit_log", "permission", "role", "document_job_blob", "document_job_text", "module_anonymous_operation", "module_citizen_alias", "module_contact_legacy", "module_contact_merge", "operation_page_metric"]);
    const tables = [];
    for (const { table_name: table } of names) {
      const [{ count }] = (await client.query(`SELECT count(*)::int AS count FROM "${String(table).replaceAll('"', '""')}"`)).rows;
      tables.push({ table, count, category: transient.has(table) ? "transient" : technical.has(table) ? "technical" : "business", populated: count > 0 });
    }
    const modules = (await client.query("SELECT family,status,count(*)::int AS count FROM module_record GROUP BY family,status ORDER BY family,status")).rows;
    const moduleCoverage = Object.entries(families).map(([family, label]) => ({ family, label, count: modules.filter(r => r.family === family).reduce((n, r) => n + r.count, 0), statuses: modules.filter(r => r.family === family).map(r => ({ status: r.status, count: r.count })) }));
    const documentTypes = (await client.query("SELECT type,status,count(*)::int AS count FROM document GROUP BY type,status ORDER BY type,status")).rows;
    const features = (await client.query(`SELECT
      (SELECT count(*)::int FROM module_record WHERE jsonb_array_length(coalesce(data->'inspections','[]'))>0) AS inspections,
      (SELECT count(*)::int FROM module_record WHERE jsonb_array_length(coalesce(data->'measurements','[]'))>0) AS measured_plans,
      (SELECT count(*)::int FROM module_record WHERE jsonb_array_length(coalesce(data->'signatures','[]'))>0) AS signature_requests,
      (SELECT count(*)::int FROM module_record WHERE family='camadas' AND data->'geometry' IS NOT NULL) AS geographic_layers,
      (SELECT count(*)::int FROM operation_progress WHERE certificate_code IS NOT NULL) AS certificates,
      (SELECT count(*)::int FROM operation_ticket WHERE status='RESOLVED') AS resolved_tickets,
      (SELECT count(*)::int FROM document_job WHERE status='SUCCEEDED') AS completed_document_jobs,
      (SELECT count(*)::int FROM operation_report_job WHERE status='READY' AND expires_at>now()) AS completed_report_jobs,
      (SELECT count(*)::int FROM pg_constraint WHERE contype='f' AND NOT convalidated) AS unvalidated_foreign_keys`)).rows[0];
    await client.query("COMMIT");
    const report = { at: new Date().toISOString(), mode: "read-only", tables, moduleCoverage, documentTypes, features, summary: { tables: tables.length, populatedTables: tables.filter(t => t.populated).length, emptyBusinessTables: tables.filter(t => t.category === "business" && !t.populated).map(t => t.table), moduleFamilies: moduleCoverage.length, populatedFamilies: moduleCoverage.filter(f => f.count > 0).length }, note: "Empty technical/transient tables do not imply a missing screen example. Identity, government receipts, certified signatures and outbound delivery require genuine provider operations; they must not be fabricated." };
    mkdirSync(resolve(output, ".."), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify({ output, ...report.summary }));
  } finally { await client.end(); }
}
void main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : "Falha no inventário de cobertura; nenhuma escrita executada."); process.exitCode = 1; });
