"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";

type Doc = { id: string; type: string; displayNumber: string; subject: string; status: string; origin: string; currentDepartment?: string; createdAt: string };
const types: Record<string, string> = { MEMORANDUM: "Memorando", OFICIO: "Ofício", EXTERNAL_REQUEST: "Protocolo externo", CIRCULAR: "Circular" };
export default function DocumentosPage() {
  const { user, permissions } = useSession();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [type, setType] = useState(""); const [status, setStatus] = useState(""); const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const all: Doc[] = [];
        let page = 1;
        while (true) {
          const data = await api(`/api/documents?page=${page}&pageSize=100`);
          if (cancelled) return;
          all.push(...data.documents);
          if (!data.total || all.length >= data.total || data.documents.length === 0) break;
          page++;
        }
        setDocs(all);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [user, reload]);
  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user) return <p><Link href="/admin">Entre na sua conta</Link> para acessar os documentos.</p>;
  return <DataTable id="documents" title="Documentos e protocolos" rows={docs.filter((d) => (!type || d.type === type) && (!status || d.status === status) && (!origin || d.origin === origin))} rowKey={(d) => d.id} loading={loading} error={error}
    filters={<><label>Tipo<select value={type} onChange={(e) => setType(e.target.value)}><option value="">Todos</option>{Array.from(new Set(docs.map((d) => d.type))).map((value) => <option key={value} value={value}>{types[value] ?? value}</option>)}</select></label><label>Situação<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas</option>{Array.from(new Set(docs.map((d) => d.status))).map((value) => <option key={value}>{value}</option>)}</select></label><label>Origem<select value={origin} onChange={(e) => setOrigin(e.target.value)}><option value="">Todas</option>{Array.from(new Set(docs.map((d) => d.origin).filter(Boolean))).map((value) => <option key={value}>{value}</option>)}</select></label></>}
    actions={<><button className="btn" onClick={() => setReload((v) => v + 1)}>Atualizar</button><Link className="btn" href="/calendario">Calendário</Link>{(permissions.includes("*") || permissions.includes("doc:create")) && <Link href="/documentos/novo" className="btn btn-primary">Novo documento</Link>}</>}
    columns={[
      { key: "number", label: "Número", value: (d) => d.displayNumber, render: (d) => <Link href={`/documentos/${d.id}`}>{d.displayNumber}</Link> },
      { key: "type", label: "Tipo", value: (d) => types[d.type] ?? d.type },
      { key: "subject", label: "Assunto", value: (d) => d.subject },
      { key: "status", label: "Situação", value: (d) => d.status },
      { key: "origin", label: "Origem", value: (d) => d.origin ?? "—" },
      { key: "created", label: "Criado em", value: (d) => new Date(d.createdAt).toLocaleDateString("pt-BR") },
    ]} />;
}
