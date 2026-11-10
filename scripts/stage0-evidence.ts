import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

async function main() {
  const root = resolve(process.env.LOCALAPPDATA ?? "", "Temp/opencode");
  const databaseRun = process.argv[2];
  if (!databaseRun || !/^stage0-\d+$/.test(databaseRun)) throw new Error("Informe o nome stage0-<instante> da execução local aprovada.");
  const databaseResult = JSON.parse(readFileSync(join(root, databaseRun, "results.json"), "utf8"));
  assert.equal(databaseResult.results.length, 3);
  assert.deepEqual(databaseResult.results.map((r: { environment: string }) => r.environment), ["desenvolvimento", "homologacao", "apresentacao"]);
  for (const r of databaseResult.results) { assert.equal(r.tables, 50); assert.equal(r.applied, 10); assert.equal(r.rollback, "PASS"); assert.equal(r.checksums, "PASS"); assert.equal(r.foreignKeys, "PASS"); }
  const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  const sourceHash = (path: string) => createHash("sha256").update(/\.(pdf|docx)$/.test(path) ? readFileSync(path) : readFileSync(path, "utf8").replace(/\r\n/g, "\n")).digest("hex");
  const sourceFiles = [
    "docs/PLANO_DESENVOLVIMENTO_POC_E_IMPLANTACAO.md", "docs/MATRIZ_REQUISITOS_IMPLANTACAO.md", "docs/CONTROLE_REQUISITOS.json",
    "docs/PLANO_DADOS_ENSAIO.md", "docs/TAREFAS_REGRESSAO_F01_F12.md", "docs/AMBIENTES_E_RELEASES.md", "docs/FECHAMENTO_ETAPA_0.md",
    "docs/IMPLANTACAO_ETAPAS_0_9.md", "docs/PREGÃO 60-2026 1 PROTOCOLO ELETRÔNICO.pdf", "docs/03 TR.pdf", "docs/edital retificado.docx",
    "src/db/bootstrap/legacy-base.sql", "scripts/migrate.ts", "scripts/stage0-register.ts", "scripts/validate-stage0-databases.ts", "scripts/stage0-evidence.ts",
    "config/environment.example", "package.json", "package-lock.json",
    ...readdirSync("src/db/migrations").filter(name => name.endsWith(".sql")).map(name => `src/db/migrations/${name}`),
  ];
  const artifacts = [
    `${databaseRun}/results.json`, "rio-restored-20261110/restore-result.json",
    "integrated-a09deb90-e73d-4887-9d7e-69dd37ab5ca2/results.redacted.json",
    "contacts-4e6b4aaf-9938-4b2f-8d77-7e1aa4ad2979/results.redacted.json",
    "learning-support-16c66554-83c1-486e-9b23-d87c0e254cb7/results.redacted.json",
    "operations-validation-85babb78-3843-4925-9bd1-04925492ed9b/results.redacted.json",
  ].map(path => ({ path, sha256: sha(join(root, path)) }));
  const response = await fetch("https://rioazul.celeriflow.com.br/api/health", { signal: AbortSignal.timeout(30000), redirect: "error" });
  assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  const registry = JSON.parse(readFileSync("docs/CONTROLE_REQUISITOS.json", "utf8"));
  const report = { version: 1, executedAt: new Date().toISOString(), responsible: "Execução técnica Celeriflow assistida pelo agente; homologação municipal não atribuída", scope: "Organização e base de execução da etapa 0", groups: registry.groups.length, individualRequirements: registry.groups.reduce((sum: number, group: { requirements: unknown[] }) => sum + group.requirements.length, 0), published: { url: "https://rioazul.celeriflow.com.br", deployment: "4rCT9aejbqj2eorMQKR9sGFiyYgN", healthStatus: response.status, healthOk: true, note: "Health verifica aplicação/banco, não todas as funções nem atualização do GitHub." }, localDataPreparation: databaseResult, artifactsRoot: "%LOCALAPPDATA%/Temp/opencode", privateArtifacts: artifacts, sources: sourceFiles.map(path => ({ path, normalization: /\.(pdf|docx)$/.test(path) ? "binary" : "UTF-8 LF", sha256: sourceHash(path) })) };
  writeFileSync("docs/EVIDENCIAS_ETAPA_0.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ groups: report.groups, individualRequirements: report.individualRequirements, databases: 3, historicalArtifacts: artifacts.length, sourceFiles: sourceFiles.length, healthStatus: response.status }));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Falha na evidência"); process.exitCode = 1; });
