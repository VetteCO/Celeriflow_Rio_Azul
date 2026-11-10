import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";

async function main() {
  if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("O executor documental exige Node.js 22 ou superior.");
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL no ambiente do worker.");
  const { workerTick } = await import("../src/lib/jobs/worker");
  let stopping = false;
  process.once("SIGTERM", () => { stopping = true; }); process.once("SIGINT", () => { stopping = true; });
  do {
    try { const processed = await workerTick(); if (!processed && !process.argv.includes("--once")) await delay(5000); }
    catch (error) { console.error("[document-worker]", error); if (process.argv.includes("--once")) throw error; await delay(10000); }
  } while (!stopping && !process.argv.includes("--once"));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
