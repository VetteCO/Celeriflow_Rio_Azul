import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const root = resolve(process.env.LOCALAPPDATA!, "Temp/opencode");
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const runs = process.argv.slice(2).map(name => {
  const directory = resolve(root, name); assert.ok(directory.startsWith(root + "\\"));
  const result = JSON.parse(readFileSync(join(directory, "results.json"), "utf8"));
  assert.equal(result.complete, true); assert.ok(result.results.every((r: { outcome: string }) => r.outcome === "PASS"));
  const summary = JSON.parse(readFileSync(join(directory, "snapshot-summary.json"), "utf8"));
  return { directory: name, at: result.at, base: result.base, passed: result.results.length, failed: 0, originalTables: summary.tables,
    originalAttachmentHashes: summary.originals.map((f: { sha256: string; actualBytes: number }) => ({ sha256: f.sha256, actualBytes: f.actualBytes })),
    artifacts: readdirSync(directory).filter(file => /^(results\.json|circular-recipients\.png|public-mobile\.png)$/.test(file)).map(file => ({ file, sha256: hash(join(directory, file)) })), assertions: result.results };
});
assert.ok(runs.length);
const sources: string[] = [];
function walk(path: string) { for (const name of readdirSync(path)) { const file = join(path, name); if (statSync(file).isDirectory()) walk(file); else if (/\.(tsx?|sql)$/.test(file)) sources.push(file.replaceAll("\\", "/")); } }
for (const path of ["src/lib", "src/components", "src/db/migrations", "src/app/api/circulars", "src/app/api/cidadao", "src/app/api/publico", "src/app/api/documents", "src/app/circulares", "src/app/cidadao", "src/app/publico", "src/app/documentos"]) walk(path);
sources.push("src/db/schema.ts", "scripts/validate-stages-3-4.ts", "scripts/validate-stages-1-2.ts");
writeFileSync("docs/EVIDENCIAS_ETAPAS_3_4.json", JSON.stringify({ version: 1, purpose: "Fechamento técnico das etapas 3 e 4; homologação municipal tem aceite próprio.", runs, sources: sources.sort().map(file => ({ file, sha256: hash(file) })) }, null, 2) + "\n");
console.log(JSON.stringify({ passed: runs.map(r => r.passed), output: "docs/EVIDENCIAS_ETAPAS_3_4.json" }));
