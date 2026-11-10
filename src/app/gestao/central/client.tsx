"use client";
import Link from "next/link";
import { externalRequest } from "@/app/cidadao/conta/ExternalAccount";
export { useExternalAccount } from "@/app/cidadao/conta/ExternalAccount";
export async function externalJson(path: string, init?: RequestInit) { return (await externalRequest(path, init)).json(); }
export async function externalDownload(path: string, filename: string) {
  const response = await externalRequest(path); const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function AccountRequired() { return <section className="card"><h1>Central de atendimento</h1><p>Utilize sua conta com e-mail confirmado para consultar, solicitar serviços e representar terceiros autorizados.</p><Link href="/cidadao/conta" className="btn btn-primary">Entrar ou criar conta</Link></section>; }
