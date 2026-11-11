import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const args = process.argv.slice(2), index = args.indexOf("--base"), base = args[index + 1];
  assert.ok(index >= 0 && args.includes("--allow-write") && (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) || args.includes("--allow-production") && base === "https://rioazul.celeriflow.com.br"));
  const directory = join(resolve(process.env.LOCALAPPDATA!, "Temp/opencode"), `workflow-fields-${Date.now()}`); mkdirSync(directory);
  const run = (file: string, flags: string[]) => spawnSync(process.execPath, ["--import", "tsx", "--env-file=.env.local", file, ...flags], { stdio: "inherit", env: process.env }).status;
  assert.equal(run("scripts/validate-stages-1-2.ts", ["--snapshot", "--directory", directory]), 0);
  const sql = neon(process.env.DATABASE_URL!);
  const [admin] = await sql("SELECT u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND r.name='ADMIN_GERAL' AND u.firebase_uid IS NOT NULL ORDER BY u.id LIMIT 1"); assert.ok(admin);
  const result = run("scripts/validate-integrated.ts", ["--allow-write", "--base", base, "--admin-uid", admin.firebase_uid as string, "--workflow-fields", "--directory", directory]);
  const preserved = run("scripts/validate-stages-1-2.ts", ["--verify-preserved", "--directory", directory]);
  const results = [...JSON.parse(readFileSync(join(directory, "results.redacted.json"), "utf8")).evidence, ...JSON.parse(readFileSync(join(directory, "results.json"), "utf8")).results];
  const report = { at: new Date().toISOString(), base, complete: result === 0 && preserved === 0, passed: results.filter(r => r.outcome === "PASS").length, failed: results.filter(r => r.outcome === "FAIL").length, preserved: preserved === 0, results };
  writeFileSync(join(directory, "acceptance.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ directory, ...report, results: undefined })); process.exitCode = report.complete ? 0 : 1;
}
void main().catch(() => { console.error("Validação dos formulários interrompida. Confira o diretório privado da rodada."); process.exitCode = 1; });
