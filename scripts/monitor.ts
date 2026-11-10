import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.env.MONITOR_URL;
const interval = Number(process.env.MONITOR_INTERVAL_SECONDS ?? 60);
const output = resolve(process.env.MONITOR_LOG_PATH ?? "availability.jsonl");
const threshold = Number(process.env.MONITOR_FAILURE_THRESHOLD ?? 2);
let stopped = false;
let failures = 0;
let incident = false;
let lastAlertSucceeded = true;
process.on("SIGINT", () => { stopped = true; });
process.on("SIGTERM", () => { stopped = true; });

async function alert(state: "DOWN" | "RECOVERED", at: string) {
  if (!process.env.MONITOR_ALERT_WEBHOOK) return false;
  try {
    const response = await fetch(process.env.MONITOR_ALERT_WEBHOOK, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: "Celeriflow", state, at, consecutiveFailures: failures }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch { return false; }
}

async function main() {
  if (!target || !/^https?:\/\//.test(target) || !Number.isFinite(interval) || interval < 10 || !Number.isInteger(threshold) || threshold < 1) throw new Error("Configure MONITOR_URL, intervalo mínimo de 10 segundos e limite de falhas válido.");
  do {
    const started = performance.now();
    const at = new Date().toISOString();
    let ok = false, status: number | null = null;
    try {
      const response = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(Math.min(interval * 900, 15000)) });
      status = response.status;
      const data = await response.json();
      ok = response.ok && data.ok === true;
    } catch { /* The failed probe is recorded below. */ }
    const durationMs = Math.round(performance.now() - started);
    failures = ok ? 0 : failures + 1;
    if (failures >= threshold && (!incident || !lastAlertSucceeded)) { incident = true; lastAlertSucceeded = await alert("DOWN", at); }
    if (ok && incident) { lastAlertSucceeded = await alert("RECOVERED", at); if (lastAlertSucceeded) incident = false; }
    await appendFile(output, JSON.stringify({ at, ok, status, durationMs, incident, alertDelivered: lastAlertSucceeded }) + "\n");
    console.log(JSON.stringify({ at, ok, status, durationMs }));
    if (process.argv.includes("--once")) return;
    const wait = Math.max(0, interval * 1000 - (performance.now() - started));
    await new Promise(resolve => setTimeout(resolve, wait));
  } while (!stopped);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Falha no monitoramento."); process.exitCode = 1; });
