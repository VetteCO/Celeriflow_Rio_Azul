"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { api, getToken, useSession } from "@/components/session";
import type { ProcessNode } from "@/lib/process-tree";

type FileRow = { id: string; nodeKey: string; filename: string; category: string; size: number | null; sha256: string | null; createdAt: string; downloadUrl: string };
function ProcessTreePage() {
  const params = useSearchParams(), { user } = useSession();
  const type = params.get("type"), id = params.get("id");
  const [data, setData] = useState<{ nodes: ProcessNode[]; files: FileRow[] }>({ nodes: [], files: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState<string>(), [message, setMessage] = useState("");
  const [view, setView] = useState<"nodes" | "files">("nodes"), [busy, setBusy] = useState(false);
  const [nodeKey, setNodeKey] = useState(""), [selected, setSelected] = useState<string[]>([]);
  const requestKeys = useRef<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    if (!user) { setLoading(user === undefined); return; }
    setLoading(true); setError(undefined);
    api(`/api/process-tree?type=${encodeURIComponent(type ?? "")}&id=${encodeURIComponent(id ?? "")}`).then(result => { if (active) { setData(result); setSelected([]); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, type, id]);
  async function download(file: FileRow) {
    try {
      const response = await fetch(file.downloadUrl, { headers: { authorization: `Bearer ${await getToken()}` } });
      if (!response.ok) throw new Error("Não foi possível baixar o original.");
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = file.filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError((e as Error).message); }
  }
  async function compile(kind: "PDF" | "ZIP", custom = false) {
    if (busy || !data.nodes.length) return;
    setBusy(true); setError(undefined);
    const sources = custom ? data.nodes.filter(n => selected.some(fileId => data.files.some(f => f.id === fileId && f.nodeKey === n.key))).map(({ type, id }) => ({ type, id })) : [{ type, id }];
    const selection = custom ? "custom" : "complete";
    const body = { kind, sources, selection, ...(custom ? { fileIds: selected } : {}) };
    const key = JSON.stringify(body); requestKeys.current[key] ??= crypto.randomUUID();
    try { const result = await api("/api/jobs", { method: "POST", body: JSON.stringify({ ...body, idempotencyKey: requestKeys.current[key] }) }); setMessage(`Solicitação ${result.job.code} registrada. Acompanhe em Processamento.`); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (user === null) return <p>Entre na sua conta institucional para consultar a árvore processual. <Link href="/admin">Entrar</Link></p>;
  const controls = <><Link className="btn" href={type === "module" ? `/gestao/registros/${id}` : `/documentos/${id}`}>Voltar ao registro</Link><button onClick={() => setView(view === "nodes" ? "files" : "nodes")}>{view === "nodes" ? "Anexos unificados" : "Documentos vinculados"}</button><button disabled={busy || !data.nodes.length} onClick={() => void compile("PDF")}>PDF completo</button><button disabled={busy || !data.nodes.length} onClick={() => void compile("ZIP")}>ZIP completo</button><Link className="btn" href="/processamento">Processamento</Link></>;
  const filters = <>{message && <p role="status">{message}</p>}<p>Exibidos somente registros e originais autorizados. Cada registro aparece uma vez, mesmo quando há vínculos circulares. O nível indica o caminho a partir do registro de entrada.</p></>;
  if (view === "files") return <DataTable id="process-tree-files" title="Anexos unificados" rows={data.files.filter(f => !nodeKey || f.nodeKey === nodeKey)} rowKey={f => f.id} loading={loading} error={error} actions={<>{controls}<button disabled={busy || !selected.length} onClick={() => void compile("ZIP", true)}>ZIP selecionados ({selected.length})</button></>} filters={<>{filters}<label>Documento<select value={nodeKey} onChange={e => setNodeKey(e.target.value)}><option value="">Todos</option>{data.nodes.map(n => <option key={n.key} value={n.key}>{n.code} — {n.title}</option>)}</select></label></>} columns={[
    { key: "selected", label: "Incluir", value: f => selected.includes(f.id) ? "Incluído" : "", render: f => <input type="checkbox" aria-label={`Incluir ${f.filename}`} checked={selected.includes(f.id)} onChange={() => setSelected(ids => ids.includes(f.id) ? ids.filter(id => id !== f.id) : [...ids, f.id])} /> },
    { key: "filename", label: "Arquivo", value: f => f.filename }, { key: "document", label: "Documento", value: f => data.nodes.find(n => n.key === f.nodeKey)?.code ?? "—" }, { key: "category", label: "Categoria", value: f => f.category }, { key: "size", label: "Bytes", value: f => f.size ?? 0 }, { key: "hash", label: "SHA-256", value: f => f.sha256 ?? "Disponível na exportação" }, { key: "actions", label: "Ação", value: () => "Baixar original", render: f => <button onClick={() => void download(f)}>Baixar original</button> },
  ]} />;
  return <DataTable id="process-tree-nodes" title="Árvore processual" rows={data.nodes} rowKey={n => n.key} loading={loading} error={error} actions={controls} filters={filters} columns={[
    { key: "depth", label: "Nível", value: n => n.depth }, { key: "code", label: "Código", value: n => n.code, render: n => <Link href={n.href}>{n.code}</Link> }, { key: "title", label: "Assunto", value: n => n.title }, { key: "parent", label: "Vinculado por", value: n => data.nodes.find(p => p.key === n.parent)?.code ?? "Entrada" }, { key: "origin", label: "Origem", value: n => n.type === "module" ? "Gestão municipal" : "Núcleo documental" }, { key: "revision", label: "Revisão", value: n => n.revision ?? "Original" }, { key: "actions", label: "Ações", value: () => "Anexos", render: n => <button onClick={() => { setNodeKey(n.key); setView("files"); }}>Anexos</button> },
  ]} />;
}
export default function Page() { return <Suspense fallback={<p>Carregando árvore processual…</p>}><ProcessTreePage /></Suspense>; }
