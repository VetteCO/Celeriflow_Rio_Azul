"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
import { configFamilies, families, familySchema } from "@/lib/modules/domain";
import { download, type RecordRow, type Options } from "../client";
export default function ModuleList() {
  const params = useParams<{ family: string }>();
  const { user } = useSession(); const family = familySchema.safeParse(params.family);
  const [rows, setRows] = useState<RecordRow[]>([]); const [options, setOptions] = useState<Options>();
  const [error, setError] = useState<string>(); const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) { setLoading(false); return; } let cancelled = false; setLoading(true);
    Promise.all([api(`/api/modules/${params.family}`), api("/api/modules/options")]).then(([data, opts]) => { if (!cancelled) { setRows(data.records); setOptions(opts); } }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, params.family]);
  if (!family.success) return <p>Módulo não encontrado.</p>;
  if (!user && user !== undefined) return <p>Entre na sua conta para acessar este módulo. <Link href="/admin">Entrar</Link></p>;
  const writable = options?.canCreate && (!configFamilies.includes(family.data) || options.admin);
  return <DataTable id={`modules-${params.family}`} title={families[family.data]} rows={rows} rowKey={row => row.id} loading={loading} error={error} actions={<><Link href="/gestao" className="btn">Módulos</Link>{writable && <Link href={`/gestao/${params.family}/novo`} className="btn btn-primary">Novo registro</Link>}{writable && family.data === "classificacao" && <Link className="btn" href="/gestao/classificacao/lote">Importar e reclassificar</Link>}{writable && family.data === "contatos" && <Link href="/gestao/contatos/importar" className="btn">Importar</Link>}<Link className="btn" href="/gestao/assinaturas">Assinaturas</Link><button className="btn" onClick={() => download(`/api/modules/${params.family}/export`, `${params.family}.csv`).catch(e => setError(e.message))}>Exportar CSV</button></>} columns={[
    { key: "code", label: "Código", value: row => row.code, render: row => <Link href={`/gestao/registros/${row.id}`}>{row.code}</Link>, width: 170 },
    { key: "title", label: "Assunto", value: row => row.title },
    { key: "status", label: "Situação", value: row => row.status.replaceAll("_", " ") },
    { key: "classification", label: "Classificação e etiquetas", value: row => [row.classification, ...(row.tags ?? [])].filter(Boolean).join(" · ") },
    { key: "dueAt", label: "Prazo", value: row => row.dueAt ? new Date(row.dueAt).toLocaleDateString("pt-BR") : "—", width: 120 },
    { key: "updatedAt", label: "Atualizado", value: row => new Date(row.updatedAt).toLocaleDateString("pt-BR"), width: 120 },
  ]} />;
}
