import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { ConfigurationError, PermanentError } from "./types";

export async function binary(name: string) {
  const path = process.env[name]?.trim();
  if (!path) throw new ConfigurationError(`Configure ${name} no ambiente do worker.`);
  try { await access(path); } catch { throw new ConfigurationError(`Executável/arquivo de ${name} não está disponível no worker.`); }
  return path;
}
export async function run(executable: string, args: string[], signal: AbortSignal, timeout = 120000) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, signal, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", errors = "", tooLarge = false, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeout);
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); if (output.length > 8 * 1024 * 1024) { tooLarge = true; child.kill("SIGKILL"); } });
    child.stderr.on("data", (chunk: Buffer) => { errors = (errors + chunk.toString()).slice(-4000); });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => {
      clearTimeout(timer);
      if (signal.aborted) reject(new Error("Lease interrompido."));
      else if (tooLarge) reject(new PermanentError("Saída do conversor excede o limite de 8 MiB."));
      else if (timedOut) reject(new Error("Tempo limite do conversor excedido."));
      else if (code !== 0) { console.error("[jobs converter]", errors); reject(new Error(`Conversor terminou com código ${code}.`)); }
      else resolve(output);
    });
  });
}
