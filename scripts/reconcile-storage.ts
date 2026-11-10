import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { list } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";

/** Read-only reconciliation. Unreferenced objects are evidence, never automatic deletion targets. */
async function main() {
  const index = process.argv.indexOf("--output");
  if (index < 0 || !process.argv[index + 1]) throw new Error("Informe --output <manifesto-privado.json>.");
  const sql = neon(process.env.DATABASE_URL!);
  const known = new Set<string>();
  const tables = await sql("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND data_type='text' AND (column_name IN ('storage_key','output_key') OR (table_name='document_job_blob' AND column_name IN ('key','pathname'))) ");
  for (const row of tables) {
    const quote = (s: string) => '"' + s.replaceAll('"','""') + '"';
    const values = await sql(`SELECT DISTINCT ${quote(String(row.column_name))} AS key FROM ${quote(String(row.table_name))} WHERE ${quote(String(row.column_name))} IS NOT NULL`);
    for (const value of values) {
      known.add(value.key);
      try { known.add(decodeURIComponent(new URL(value.key).pathname.slice(1))); } catch { /* pathname stored directly */ }
    }
  }
  const candidates: { pathname: string; uploadedAt: string; bytes: number; ageHours: number }[] = [];
  const seen = new Set<string>(); let cursor: string | undefined, total = 0;
  do {
    const page = await list({ cursor, limit: 1000, token: (process.env.BLOB_READ_WRITE_TOKEN ?? "").trim().replace(/^"|"$/g, "") });
    for (const blob of page.blobs) {
      total++; seen.add(blob.pathname); seen.add(blob.url);
      if (!known.has(blob.pathname) && !known.has(blob.url)) candidates.push({ pathname: blob.pathname, uploadedAt: blob.uploadedAt.toISOString(), bytes: blob.size, ageHours: Math.floor((Date.now()-blob.uploadedAt.getTime())/3600000) });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const missing = [...known].filter(key => !seen.has(key) && ![...seen].some(s => { try { return decodeURIComponent(new URL(s).pathname.slice(1))===key; } catch { return false; } }));
  const report = { at: new Date().toISOString(), totalObjects: total, candidates, missingReferences: missing,
    scope: "Inventário privado de leitura. Uploads em andamento ou com resultado incerto podem aparecer como candidatos; revalidar referências antes de qualquer ação operacional. Nenhum objeto excluído." };
  const bytes = JSON.stringify(report,null,2); await writeFile(process.argv[index+1],bytes,{mode:0o600});
  console.log(JSON.stringify({ totalObjects:total,unreferencedCandidates:candidates.length,missingReferences:missing.length,manifestHash:createHash("sha256").update(bytes).digest("hex") }));
}
main().catch(()=>{console.error("Falha na reconciliação. Confira acesso ao banco e armazenamento privado.");process.exitCode=1;});
