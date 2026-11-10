"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
import { download } from "../../client";
type Emission = { id: string; code: string; title: string; family: string; status: string; delegationCode: string; authorizer: string; typist: string; createdAt: string };
export default function DelegationEmissions() {
  const { user } = useSession(); const [rows, setRows] = useState<Emission[]>([]); const [id, setId] = useState(""); const [code, setCode] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const selected = new URLSearchParams(window.location.search).get("delegacao") ?? ""; setId(selected);
    api(`/api/modules/delegations/report?delegacao=${encodeURIComponent(selected)}`).then(d => { if (!stopped) { setRows(d.records); setCode(d.delegation.code); } }).catch(e => { if (!stopped) setError(e.message); }).finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [user]);
  return <DataTable id="delegation-emissions" title={`Documentos por autorização${code ? ` — ${code}` : ""}`} rows={rows} rowKey={r => r.id} loading={loading && user !== null} error={error || (user === null ? "Entre na sua conta para consultar as emissões." : "")} actions={<><Link className="btn" href={id ? `/gestao/registros/${id}` : "/gestao/delegacoes"}>Voltar à autorização</Link><button className="btn" disabled={!code} onClick={() => download(`/api/modules/delegations/report?delegacao=${encodeURIComponent(id)}&format=csv`, `emissoes-${code}.csv`).catch(e => setError(e.message))}>Exportar CSV</button></>} columns={[
    { key: "code", label: "Documento", value: r => r.code, render: r => <Link href={`/gestao/registros/${r.id}`}>{r.code}</Link> },
    { key: "title", label: "Assunto", value: r => r.title }, { key: "authorizer", label: "Autorizador", value: r => r.authorizer }, { key: "typist", label: "Digitador", value: r => r.typist },
    { key: "status", label: "Situação", value: r => r.status.replaceAll("_", " ") }, { key: "date", label: "Emissão", value: r => new Date(r.createdAt).toLocaleDateString("pt-BR") },
  ]} />;
}
