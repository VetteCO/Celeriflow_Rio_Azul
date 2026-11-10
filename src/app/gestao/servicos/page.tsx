"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
type Service = { id: string; family: string; title: string; body: string; code: string; values: Record<string, string> };
export default function ServiceCharter() {
  const [rows, setRows] = useState<Service[]>([]); const [selected, setSelected] = useState<Service>(); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/modules/public").then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setRows(data.records.filter((s: Service) => s.family === "carta")); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  if (selected) return <article className="card"><button className="btn" onClick={() => setSelected(undefined)}>Voltar aos serviços</button><h1>{selected.title}</h1><p style={{ whiteSpace: "pre-wrap" }}>{selected.body}</p><dl>{Object.entries(selected.values).filter(([key]) => key !== "assuntoId").map(([key, value]) => <div key={key}><dt><strong>{({ categoria: "Categoria", publico: "Público destinatário", requisitos: "Requisitos e documentos", canais: "Canais e locais", prazo: "Prazo máximo", etapas: "Etapas", prioridades: "Prioridades", espera: "Tempo de espera", manifestacao: "Canais de manifestação" } as Record<string, string>)[key] ?? key}</strong></dt><dd>{value}</dd></div>)}</dl><Link className="btn btn-primary" href={selected.values.assuntoId ? `/gestao/central/novo?assunto=${encodeURIComponent(selected.values.assuntoId)}` : `/cidadao?assunto=${encodeURIComponent(selected.title)}`}>Solicitar atendimento</Link></article>;
  return <DataTable id="public-services" title="Carta de Serviços" rows={rows} rowKey={r => r.id} loading={loading} error={error} columns={[
    { key: "title", label: "Serviço", value: r => r.title, render: r => <button className="btn" onClick={() => setSelected(r)}>{r.title}</button> },
    { key: "category", label: "Categoria", value: r => r.values.categoria ?? "" }, { key: "audience", label: "Público", value: r => r.values.publico ?? "" }, { key: "deadline", label: "Prazo", value: r => r.values.prazo ?? "" },
  ]} />;
}
