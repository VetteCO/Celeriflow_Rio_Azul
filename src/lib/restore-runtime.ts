import { neonConfig } from "@neondatabase/serverless";
/** Explicit rehearsal runtime. Never falls back from isolated storage to the source store. */
export function restoreRuntime() {
  if (!process.env.RESTORE_SQL_ENDPOINT && !process.env.RESTORE_STORAGE_ROOT) return false;
  const database = new URL(process.env.DATABASE_URL!);
  const endpoint = new URL(process.env.RESTORE_SQL_ENDPOINT!);
  if (process.env.VERCEL || !["localhost","127.0.0.1"].includes(database.hostname) || !["localhost","127.0.0.1"].includes(endpoint.hostname) || endpoint.protocol!=="http:" || !/(restore|ensaio|homolog)/i.test(database.pathname) || decodeURIComponent(database.pathname.slice(1))!==process.env.RESTORE_DATABASE_NAME || !process.env.RESTORE_STORAGE_ROOT || !/^[a-f0-9]{64}$/.test(endpoint.pathname.slice(1))) throw new Error("Configuração isolada de restauração inválida.");
  neonConfig.fetchEndpoint = endpoint.toString();
  return true;
}
