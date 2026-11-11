import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(process.env.LOCALAPPDATA!, "Temp/opencode"), hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const names = process.argv.slice(2);
const runs = names.filter(name => name.startsWith("stage6-")).map(name => {
  const path = resolve(root, name); assert.ok(path.startsWith(root + "\\"));
  const result = JSON.parse(readFileSync(join(path, "acceptance.json"), "utf8")), snapshot = JSON.parse(readFileSync(join(path, "snapshot-summary.json"), "utf8"));
  assert.equal(result.complete, true); assert.ok(result.results.every((r: { outcome: string }) => r.outcome === "PASS"));
  return { directory: name, at: result.at, base: result.base, passed: result.results.length, failed: 0, originalTables: snapshot.tables, originalAttachmentHashes: snapshot.originals.map((f: { sha256: string; actualBytes: number }) => ({ sha256: f.sha256, actualBytes: f.actualBytes })), artifacts: readdirSync(path).filter(file => /^(acceptance\.json|results(?:\.redacted)?\.json|pdf-preview\.png|signature-queue\.png|ged-layout\.private\.pdf|oficio\.private\.pdf|verapdf-report\.private\.json|job-(PDF|PDFA|ZIP|OCR)\.private\.(pdf|zip|json))$/.test(file)).map(file => ({ file, sha256: hash(join(path, file)) })), assertions: result.results };
});
assert.ok(runs.length);
const structural = names.filter(name => name.startsWith("stage0-")).map(name => { const file = resolve(root, name, "results.json"); assert.ok(file.startsWith(root + "\\")); const evidence = JSON.parse(readFileSync(file, "utf8")); assert.ok(evidence.results.every((r: { signatureEnvelopeGuard: string }) => r.signatureEnvelopeGuard === "PASS")); return { directory: name, sha256: hash(file), ...evidence }; });
const tools = JSON.parse(readFileSync(join(root, "stage6-tools/versions.json"), "utf8"));
const sources: string[] = [];
function walk(path: string) { for (const name of readdirSync(path)) { const file = join(path, name); if (statSync(file).isDirectory()) walk(file); else if (/\.(tsx?|sql)$/.test(file)) sources.push(file.replaceAll("\\", "/")); } }
walk("src"); for (const file of ["scripts/validate-stage6.ts", "scripts/stage6-scenarios.ts", "scripts/validate-integrated.ts", "scripts/validate-stage0-databases.ts", "scripts/document-worker.ts", "config/environment.example", "docs/PROCESSAMENTO_GED.md"]) sources.push(file);
writeFileSync("docs/EVIDENCIAS_ETAPA_6.json", JSON.stringify({ version: 1, purpose: "Etapa 6: encerramento técnico do recorte documentado. Homologação municipal, criptografia e canais externos conservam seus marcos próprios; execução pontual dos workers não comprova operação contínua.", runs, structural, tools, sources: sources.sort().map(file => ({ file, sha256: hash(file) })) }, null, 2) + "\n");
console.log(JSON.stringify({ output: "docs/EVIDENCIAS_ETAPA_6.json", passed: runs.map(r => r.passed) }));
