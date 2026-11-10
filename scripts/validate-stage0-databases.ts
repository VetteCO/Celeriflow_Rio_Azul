import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

// Only a NEW local cluster; this executor never consumes DATABASE_URL/DIRECT_URL.
const root = resolve(process.env.LOCALAPPDATA ?? "", "Temp/opencode");
const bin = join(root, "postgresql18/pgsql/bin");
const run = join(root, `stage0-${Date.now()}`);
mkdirSync(run, { recursive: false });
const password = randomBytes(32).toString("hex");
const passwordFile = join(run, "password.private");
writeFileSync(passwordFile, password, { mode: 0o600 });
const data = join(run, "postgres");
const port = "55439";
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: process.env.NODE_ENV, PGHOST: "127.0.0.1", PGPORT: port, PGUSER: "postgres", PGPASSWORD: password, PGDATABASE: "postgres", PGSSLMODE: "disable" };
function command(exe: string, args: string[], input?: string) {
  const result = spawnSync(join(bin, `${exe}.exe`), args, { env, input, encoding: "utf8", timeout: 120000, windowsHide: true });
  if (result.status !== 0) throw new Error(`${exe}: ${result.stderr || result.error?.message || result.status}`);
  return result.stdout.trim();
}
function sql(database: string, input: string) {
  return command("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", database], input);
}
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
const baseline = readFileSync("src/db/bootstrap/legacy-base.sql", "utf8").replace(/\r\n/g, "\n");
const migrations = readdirSync("src/db/migrations").filter(name => name.endsWith(".sql")).sort().map(name => ({ name, source: readFileSync(join("src/db/migrations", name), "utf8").replace(/\r\n/g, "\n") }));
const hash = (source: string) => createHash("sha256").update(source).digest("hex");
const results: Record<string, unknown>[] = [];
let started = false;
try {
  command("initdb", ["-D", data, "-U", "postgres", "--encoding=UTF8", "--locale=C", "--auth-local=trust", "--auth-host=scram-sha-256", `--pwfile=${passwordFile}`]);
  command("pg_ctl", ["-D", data, "-l", join(run, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
  started = true;
  for (const [index, name] of ["desenvolvimento", "homologacao", "apresentacao"].entries()) {
    const database = `rio_${name}`;
    command("createdb", [database]);
    sql(database, `BEGIN; ${baseline}
CREATE TABLE application_migration(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO application_migration(name,checksum) VALUES('bootstrap/legacy-base.sql',${quote(hash(baseline))}); COMMIT;`);
    for (const migration of migrations) sql(database, `BEGIN; ${migration.source}\nINSERT INTO application_migration(name,checksum) VALUES(${quote(migration.name)},${quote(hash(migration.source))}); COMMIT;`);
    const namespace = `${index + 1}0000000-0000-4000-8000-`;
    const organization = `${namespace}000000000001`, department = `${namespace}000000000002`, child = `${namespace}000000000003`;
    const user = `${namespace}000000000004`, reader = `${namespace}000000000005`;
    sql(database, `BEGIN;
INSERT INTO organization(id,name,cnpj) VALUES('${organization}','Município de Aurora das Veredas','11.222.333/0001-81');
INSERT INTO department(id,name,acronym) VALUES('${department}','Secretaria Municipal de Administração','SMA');
INSERT INTO department(id,parent_id,name,acronym) VALUES('${child}','${department}','Protocolo Geral','PROT');
INSERT INTO app_user(id,name,email,department_id) VALUES('${user}','Helena Duarte','helena.duarte.${name}@aurora.mg.gov.br','${department}'),('${reader}','Rafael Nogueira','rafael.nogueira.${name}@aurora.mg.gov.br','${child}');
INSERT INTO user_role(user_id,role_id) SELECT '${user}',id FROM role WHERE name='ADMIN_GERAL';
INSERT INTO user_role(user_id,role_id) SELECT '${reader}',id FROM role WHERE name='NIVEL_3_VISUALIZACAO';
COMMIT;`);
    const tables = Number(sql(database, "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"));
    assert.equal(Number(sql(database, "SELECT count(*) FROM application_migration;")), migrations.length + 1);
    assert.equal(Number(sql(database, "SELECT count(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated;")), 0);
    assert.equal(Number(sql(database, "SELECT count(*) FROM app_user;")), 2);
    assert.equal(Number(sql(database, "SELECT count(*) FROM app_user WHERE firebase_uid IS NOT NULL;")), 0);
    const snapshot = sql(database, "SELECT md5(string_agg(id::text || email,',' ORDER BY id)) FROM app_user;");
    assert.ok(!results.some(result => result.fixtureFingerprint === snapshot));
    const history = sql(database, "SELECT name || ':' || checksum FROM application_migration ORDER BY name;");
    for (const migration of migrations) assert.ok(history.includes(`${migration.name}:${hash(migration.source)}`));
    // Explicit failure inside a transaction proves rollback without disturbing the fixture.
    const rejected = spawnSync(join(bin, "psql.exe"), ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", database], { env, encoding: "utf8", input: "BEGIN; INSERT INTO organization(name) VALUES('rollback-stage0'); SELECT 1/0; COMMIT;", windowsHide: true });
    assert.notEqual(rejected.status, 0);
    assert.equal(sql(database, "SELECT count(*) FROM organization WHERE name='rollback-stage0';"), "0");
    const folder = join(run, name); mkdirSync(folder); mkdirSync(join(folder, "files"));
    writeFileSync(join(folder, "fixture.json"), JSON.stringify({ environment: name, database, municipality: "Aurora das Veredas/MG", organization, department, child, adminId: user, readerId: reader, cpf: "529.982.247-25", cnpj: "11.222.333/0001-81", authProvisioned: false, mailEnabled: false, cases: ["Admin x leitura", "Memorando com dois prazos", "Circular para subsetores", "Requerimento no Protocolo", "Consulta por chave com sigilo"] }, null, 2));
    results.push({ environment: name, database, tables, applied: migrations.length + 1, fixtureFingerprint: snapshot, users: 2, departments: 2, rollback: "PASS", foreignKeys: "PASS", checksums: "PASS", authProvisioned: false });
  }
  writeFileSync(join(run, "results.json"), JSON.stringify({ executedAt: new Date().toISOString(), scope: "isolated local preparation databases; no production connection", baselineSha256: hash(baseline), migrations: migrations.map(m => ({ name: m.name, sha256: hash(m.source) })), results }, null, 2));
  console.log(JSON.stringify({ evidence: join(run, "results.json"), results }, null, 2));
} finally {
  if (started) command("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
}
