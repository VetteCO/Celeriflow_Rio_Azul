import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.env.LOCALAPPDATA!, "Temp/opencode");
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const runs = process.argv.slice(2).map(name => {
  const directory = resolve(root, name); assert.ok(directory.startsWith(root + "\\"));
  const acceptance = existsSync(join(directory, "acceptance.json")) ? "acceptance.json" : "results.json";
  const result = JSON.parse(readFileSync(join(directory, acceptance), "utf8"));
  assert.equal(result.complete, true); assert.ok(result.results.every((r: { outcome: string }) => r.outcome === "PASS"));
  const summary = JSON.parse(readFileSync(join(directory, "snapshot-summary.json"), "utf8"));
  return { directory: name, at: result.at, base: result.base, passed: result.results.length, failed: 0, originalTables: summary.tables,
    originalAttachmentHashes: summary.originals.map((f: { sha256: string; actualBytes: number }) => ({ sha256: f.sha256, actualBytes: f.actualBytes })),
    artifacts: readdirSync(directory).filter(file => /^(acceptance\.json|results(?:\.redacted)?\.json|delegation-report\.png|service-charter\.png|circular-recipients\.png|public-mobile\.png|process-(PDF|ZIP)-(complete|custom)\.private\.(pdf|zip))$/.test(file)).map(file => ({ file, sha256: hash(join(directory, file)) })), assertions: result.results };
});
assert.ok(runs.length);
const sources: string[] = [];
function walk(path: string) { for (const name of readdirSync(path)) { const file = join(path, name); if (statSync(file).isDirectory()) walk(file); else if (/\.(tsx?|sql)$/.test(file)) sources.push(file.replaceAll("\\", "/")); } }
walk("src");
for (const file of ["scripts/validate-integrated.ts", "scripts/validate-stages-1-2.ts", "scripts/validate-stages-3-4.ts", "scripts/validate-stages-5-7.ts", "scripts/stages57-scenarios.ts", "scripts/document-worker.ts"]) sources.push(file);
writeFileSync("docs/EVIDENCIAS_ETAPAS_5_7.json", JSON.stringify({ version: 1, purpose: "Verificação técnica das etapas 5 e 7; aceite municipal, identidade avançada, canais reais, assinatura certificada e operação contínua têm marcos próprios.", runs, sources: sources.sort().map(file => ({ file, sha256: hash(file) })) }, null, 2) + "\n");
console.log(JSON.stringify({ passed: runs.map(r => r.passed), output: "docs/EVIDENCIAS_ETAPAS_5_7.json" }));
