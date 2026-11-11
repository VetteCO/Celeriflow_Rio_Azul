import { writeFile } from "node:fs/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { neon } from "@neondatabase/serverless";

async function main() {
  const args = process.argv.slice(2), base = args[args.indexOf("--base") + 1];
  const output = args[args.indexOf("--output") + 1];
  if (!args.includes("--run") || !args.includes("--base") || !args.includes("--output")) throw new Error("Use --run --base <URL> --output <arquivo-json> para autorizar a carga de leitura de 60 sessões.");
  const origin = new URL(base).origin;
  const sql = neon(process.env.DATABASE_URL!);
  const auth = getAuth(initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n") }) }));
  const users = await sql("SELECT DISTINCT u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id WHERE u.active AND u.firebase_uid IS NOT NULL ORDER BY u.firebase_uid LIMIT 60");
  const eligible: string[] = [];
  for (const user of users) {
    try { const account = await auth.getUser(user.firebase_uid as string); if (!account.disabled) eligible.push(account.uid); }
    catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; }
  }
   if (eligible.length !== 60) throw new Error("O ensaio exige 60 identidades ativas distintas; use validate:stages89 para provisionamento e limpeza de identidades próprias.");
  const tokens: string[] = [];
  for (let offset = 0; offset < 60; offset += 5) {
    tokens.push(...await Promise.all(Array.from({ length: 5 }, async (_, index) => {
      const custom = await auth.createCustomToken(eligible[offset + index]);
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }), signal: AbortSignal.timeout(30000) });
      const value = await response.json();
      if (!response.ok || !value.idToken) throw new Error("Não foi possível criar as 60 sessões Firebase.");
      return value.idToken as string;
    })));
  }
  const observations: { round: number; session: number; route: string; status: number; elapsedMs: number; ok: boolean }[] = [];
  const routes = ["/api/documents?pageSize=20", "/api/circulars?pageSize=20", "/api/deadlines?month=" + new Date().toISOString().slice(0, 7)];
  const startedAt = performance.now(); let round = 0;
  do {
    observations.push(...await Promise.all(tokens.map(async (token, session) => {
      const route = routes[(session + round) % routes.length], started = performance.now();
      try {
        const response = await fetch(origin + route, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(45000) });
        const body = await response.json();
        const ok = response.status === 200 && !!body && !body.error;
        return { round: round + 1, session: session + 1, route, status: response.status, elapsedMs: Math.round(performance.now() - started), ok };
      } catch { return { round: round + 1, session: session + 1, route, status: 0, elapsedMs: Math.round(performance.now() - started), ok: false }; }
    })));
    round++;
  } while ((performance.now() - startedAt < 60000 || round < 10) && observations.every(row => row.ok) && round < 300);
  const durations = observations.map(row => row.elapsedMs).sort((a,b)=>a-b);
  const report = { at: new Date().toISOString(), origin, concurrentSessions: 60, distinctAccounts: eligible.length, rounds: round, elapsedMs: Math.round(performance.now()-startedAt), requests: observations.length,
    passed: observations.filter(row=>row.ok).length, p50Ms: durations[Math.ceil(durations.length*.5)-1], p95Ms: durations[Math.ceil(durations.length*.95)-1], maxMs: durations.at(-1),
    scope: "Leituras autenticadas concorrentes por pelo menos 60 segundos e 10 rodadas com 60 identidades distintas. Não equivale ao perfil integral de uso municipal nem a SLA de disponibilidade.", observations };
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, observations: undefined }, null, 2));
  if (report.passed !== report.requests || report.elapsedMs < 60000 || round < 10) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Falha no ensaio de capacidade."); process.exitCode = 1; });
