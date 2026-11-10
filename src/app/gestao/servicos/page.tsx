"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { searchServices, type PublicService as Service } from "@/lib/modules/service-search";
export default function ServiceCharter() {
  const [rows, setRows] = useState<Service[]>([]); const [selected, setSelected] = useState<Service>(); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [audience, setAudience] = useState("");
  useEffect(() => { fetch("/api/modules/public").then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setRows(data.records.filter((s: Service) => s.family === "carta")); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  if (selected) return <article className="card"><button className="btn" onClick={() => setSelected(undefined)}>Voltar aos serviços</button><h1>{selected.title}</h1><p style={{ whiteSpace: "pre-wrap" }}>{selected.body}</p><dl>{Object.entries(selected.values).filter(([key]) => key !== "assuntoId").map(([key, value]) => <div key={key}><dt><strong>{({ categoria: "Categoria", publico: "Público destinatário", requisitos: "Requisitos e documentos", canais: "Canais e locais", prazo: "Prazo máximo", etapas: "Etapas", prioridades: "Prioridades", espera: "Tempo de espera", manifestacao: "Canais de manifestação" } as Record<string, string>)[key] ?? key}</strong></dt><dd>{value}</dd></div>)}</dl><Link className="btn btn-primary" href={selected.values.assuntoId ? `/gestao/central/novo?assunto=${encodeURIComponent(selected.values.assuntoId)}` : `/cidadao?assunto=${encodeURIComponent(selected.title)}`}>Solicitar atendimento</Link></article>;
  const visible = searchServices(rows, query, category, audience);
  const options = (key: string) => Array.from(new Set(rows.map(r => r.values[key]).filter(Boolean))).sort((a,b) => a.localeCompare(b, "pt-BR"));
  return <DataTable id="public-services" title="Carta de Serviços" rows={visible} rowKey={r => r.id} loading={loading} error={error} filters={<><label>O que você precisa?<input placeholder="Ex.: preciso trocar a lâmpada da rua" value={query} onChange={e => setQuery(e.target.value)} /></label><label>Categoria<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas</option>{options("categoria").map(value => <option key={value}>{value}</option>)}</select></label><label>Público destinatário<select value={audience} onChange={e => setAudience(e.target.value)}><option value="">Todos</option>{options("publico").map(value => <option key={value}>{value}</option>)}</select></label><button className="btn" onClick={() => { setQuery(""); setCategory(""); setAudience(""); }}>Limpar filtros</button></>} columns={[
    { key: "title", label: "Serviço", value: r => r.title, render: r => <button className="btn" onClick={() => setSelected(r)}>{r.title}</button> },
    { key: "category", label: "Categoria", value: r => r.values.categoria ?? "" }, { key: "audience", label: "Público", value: r => r.values.publico ?? "" }, { key: "deadline", label: "Prazo", value: r => r.values.prazo ?? "" },
  ]} />;
}
