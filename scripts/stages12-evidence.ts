import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import assert from "node:assert/strict";

const root = resolve(process.env.LOCALAPPDATA ?? "", "Temp/opencode");
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const runs = process.argv.slice(2).map(name => {
  const directory = resolve(root, name);
  assert.ok(directory.startsWith(root + "\\") || directory.startsWith(root + "/"));
  const result = JSON.parse(readFileSync(join(directory, "results.json"), "utf8"));
  assert.equal(result.complete, true);
  assert.ok(result.results.every((entry: { outcome: string }) => entry.outcome === "PASS"));
  return { directory, at: result.at, environment: result.base, passed: result.results.length, failed: 0,
    artifacts: readdirSync(directory).filter(file => /^(results\.json|.*\.png)$/.test(file)).map(file => ({ file, sha256: hash(join(directory, file)) })),
    assertions: result.results };
});
assert.ok(runs.length);
const sources: string[] = [];
function walk(path: string) { for (const name of readdirSync(path)) { const file = join(path, name); if (statSync(file).isDirectory()) walk(file); else if (/\.(tsx?|sql)$/.test(file)) sources.push(file); } }
for (const directory of ["src/lib", "src/components", "src/app/api/admin", "src/app/api/documents", "src/app/api/deadlines", "src/app/api/attachments", "src/app/admin", "src/app/setores", "src/app/documentos", "src/app/calendario", "src/db/migrations"]) walk(directory);
sources.push("src/db/schema.ts", "scripts/validate-stages-1-2.ts");
const data = { version: 1, purpose: "Fechamento técnico das etapas 1 e 2; evidência automatizada não equivale a homologação municipal.", runs, sources: sources.sort().map(file => ({ file: relative(process.cwd(), file).replaceAll("\\", "/"), sha256: hash(file) })) };
writeFileSync("docs/EVIDENCIAS_ETAPAS_1_2.json", JSON.stringify(data, null, 2) + "\n");
console.log(JSON.stringify({ runs: runs.length, passed: runs.map(run => run.passed), output: "docs/EVIDENCIAS_ETAPAS_1_2.json" }));
