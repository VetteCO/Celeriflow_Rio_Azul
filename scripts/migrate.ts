import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { neonConfig, Pool } from "@neondatabase/serverless";

async function main() {
  const apply = process.argv.includes("--apply");
  const initialize = process.argv.includes("--initialize-empty");
  const check = process.argv.includes("--check");
  if (check && (apply || initialize)) throw new Error("--check é somente leitura e não pode ser combinado com aplicação.");
  if (initialize && !apply) throw new Error("A instalação inicial exige --apply --initialize-empty.");
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString || new URL(connectionString).hostname.includes("-pooler")) throw new Error("Configure DIRECT_URL com conexão direta, sem pool transacional.");
  if (typeof WebSocket === "undefined") throw new Error("Execute as migrações com Node.js 22 ou superior.");
  neonConfig.webSocketConstructor = WebSocket;
  const folder = resolve("src/db/migrations");
  const files = (await readdir(folder)).filter(name => name.endsWith(".sql")).sort();
  const throughIndex = process.argv.indexOf("--through");
  const through = throughIndex >= 0 ? process.argv[throughIndex + 1] : undefined;
  if (throughIndex >= 0 && (!through || !files.includes(through))) throw new Error("Informe um nome de migração existente após --through.");
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : undefined;
  if (onlyIndex >= 0 && (!only || !files.includes(only))) throw new Error("Informe um nome de migração existente após --only.");
  if (!apply && !check) {
    console.log("Migrações disponíveis (nenhuma alteração aplicada):");
    for (const file of files) console.log(file);
    console.log("Para aplicar: npm run db:migrate -- --apply");
    return;
  }
  const pool = new Pool({ connectionString });
  const client = await pool.connect().catch(async error => { await pool.end(); throw error; });
  let locked = false;
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock(20261110, 1) AS acquired");
    if (!lock.rows[0]?.acquired) throw new Error("Outra instalação de migrações está em execução.");
    locked = true;
    const baselineName = "bootstrap/legacy-base.sql";
    const baselineSource = (await readFile(resolve("src/db", baselineName), "utf8")).replace(/\r\n/g, "\n");
    const baselineChecksum = createHash("sha256").update(baselineSource).digest("hex");
    const historyExists = await client.query("SELECT to_regclass('public.application_migration') AS relation");
    if (check && !historyExists.rows[0]?.relation) throw new Error("Histórico ausente; nenhuma alteração realizada.");
    if (initialize) {
      const objects = await client.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'");
      const types = await client.query("SELECT count(*)::int AS count FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'");
      if (objects.rows[0]?.count || types.rows[0]?.count) throw new Error("Instalação inicial recusada: o schema public não está vazio.");
      await client.query("BEGIN");
      try {
        await client.query(baselineSource);
        await client.query("CREATE TABLE application_migration (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
        await client.query("INSERT INTO application_migration(name,checksum) VALUES($1,$2)", [baselineName, baselineChecksum]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
    }
    if (!initialize && !historyExists.rows[0]?.relation && !process.argv.includes("--existing-schema")) {
      const tables = await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
      if (tables.rows[0]?.count > 0) throw new Error("Banco existente sem histórico deste executor. Revise as migrações incrementais e use --existing-schema para autorizar a instalação inicial; nenhuma migração foi aplicada.");
    }
    if (!check) await client.query("CREATE TABLE IF NOT EXISTS application_migration (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    const migrations = await Promise.all(files.map(async name => {
      const source = (await readFile(resolve(folder, name), "utf8")).replace(/\r\n/g, "\n");
      return { name, source, checksum: createHash("sha256").update(source).digest("hex") };
    }));
    const history = await client.query("SELECT name, checksum FROM application_migration ORDER BY name");
    for (const prior of history.rows) {
      const found = prior.name === baselineName ? { checksum: baselineChecksum } : migrations.find(m => m.name === prior.name);
      if (!found || found.checksum !== prior.checksum) throw new Error(`Migração histórica ausente ou modificada: ${prior.name}. Nenhuma pendência foi aplicada.`);
    }
    if (check) {
      const pending = migrations.filter(m => !history.rows.some(prior => prior.name === m.name));
      console.log(JSON.stringify({ mode: "read-only", historicalChecksums: history.rows.length, pending: pending.map(m => m.name) }));
      if (pending.length) process.exitCode = 1;
      return;
    }
    for (const { name, source, checksum } of migrations) {
      if (history.rows.some(prior => prior.name === name)) {
        console.log(`Já aplicada: ${name}`);
        continue;
      }
      if ((through && name > through) || (only && name !== only)) { console.log(`Adiada: ${name}`); continue; }
      await client.query("BEGIN");
      try {
        await client.query(source);
        await client.query("INSERT INTO application_migration(name,checksum) VALUES($1,$2)", [name, checksum]);
        await client.query("COMMIT");
        console.log(`Aplicada: ${name}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock(20261110, 1)").catch(() => console.error("A conexão será encerrada para liberar a trava de migração."));
    client.release();
    await pool.end();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Falha na migração"); process.exitCode = 1; });
