"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { families, type Family } from "@/lib/modules/domain";
import { AccountRequired, externalJson, useExternalAccount } from "./client";
type Row = { id: string; code: string; title: string; family: Family; status: string; represented: boolean; dueAt: string };
export default function ExternalInbox() {
  const { user, revision } = useExternalAccount(); const [rows, setRows] = useState<Row[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!user?.emailVerified) { setLoading(false); return; } let active = true; setLoading(true); externalJson("/api/modules/external").then(d => { if (active) setRows(d.records); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [user, revision]);
  if (user === undefined) return <p>Carregando conta…</p>;
  if (!user?.emailVerified) return <AccountRequired />;
  return <DataTable id="external-module-inbox" title="Meus atendimentos" rows={rows} rowKey={r => r.id} loading={loading} error={error} actions={<><Link className="btn btn-primary" href="/gestao/central/novo">Solicitar serviço</Link><Link className="btn" href="/gestao/central/mandatos">Representação e procurações</Link><Link className="btn" href="/cidadao/conta">Minha conta</Link></>} columns={[
    { key: "code", label: "Protocolo", value: r => r.code, render: r => <Link href={`/gestao/central/${r.id}`}>{r.code}</Link> }, { key: "title", label: "Assunto", value: r => r.title },
    { key: "family", label: "Serviço", value: r => families[r.family] }, { key: "status", label: "Situação", value: r => r.status.replaceAll("_", " ") }, { key: "represented", label: "Atuação", value: r => r.represented ? "Representante" : "Titular" },
  ]} />;
}
