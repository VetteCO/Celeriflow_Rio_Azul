import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const args = process.argv.slice(2), option = (key: string) => args[args.indexOf(key) + 1];
  const base = option("--base");
  assert.ok(args.includes("--allow-write") && base && (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) || args.includes("--allow-production") && base === "https://rioazul.celeriflow.com.br"));
  const directory = join(resolve(process.env.LOCALAPPDATA!, "Temp/opencode"), `stages57-${Date.now()}`);
  mkdirSync(directory, { recursive: true }); mkdirSync(join(directory, "worker"));
  process.env.JOBS_CHROMIUM_BIN ??= "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  process.env.JOBS_TEMP_DIR = join(directory, "worker");
  const run = (script: string, flags: string[]) => spawnSync(process.execPath, ["--import", "tsx", "--env-file=.env.local", script, ...flags], { stdio: "inherit", env: process.env }).status;
  assert.equal(run("scripts/validate-stages-1-2.ts", ["--snapshot", "--directory", directory]), 0);
  const sql = neon(process.env.DATABASE_URL!);
  const [administrator] = await sql("SELECT u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND r.name='ADMIN_GERAL' AND u.firebase_uid IS NOT NULL ORDER BY u.id LIMIT 1");
  assert.ok(administrator);
  const result = run("scripts/validate-integrated.ts", ["--allow-write", "--base", base!, "--admin-uid", administrator.firebase_uid, "--intake-department", process.env.DEFAULT_INTAKE_DEPARTMENT_ID!, "--external", "--stages57", "--directory", directory]);
  const preserved = run("scripts/validate-stages-1-2.ts", ["--verify-preserved", "--directory", directory]);
  const integrated = JSON.parse(readFileSync(join(directory, "results.redacted.json"), "utf8"));
  const checks = JSON.parse(readFileSync(join(directory, "results.json"), "utf8"));
  const all = [...integrated.evidence, ...checks.results];
  writeFileSync(join(directory, "acceptance.json"), JSON.stringify({ complete: result === 0 && preserved === 0, base, at: new Date().toISOString(), results: all }, null, 2));
  console.log(JSON.stringify({ directory, passed: all.filter(r => r.outcome === "PASS").length, failed: all.filter(r => r.outcome === "FAIL").length, blocked: all.filter(r => r.outcome === "BLOCKED").length, preserved: preserved === 0 }));
  process.exitCode = result === 0 && preserved === 0 ? 0 : 1;
}
void main().catch(() => { console.error("Stages 5/7 interrupted; inspect the private run directory."); process.exitCode = 1; });
