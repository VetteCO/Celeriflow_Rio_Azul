"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, getToken, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";

type Source = { id: string; type: "document" | "module"; title: string; code: string | null };
type FileOption = { id: string; sourceId: string; filename: string; mimeType: string | null; size: number | null };
type Job = { id: string; code: string; kind: string; status: string; attempts: number; error: string | null; createdAt: string; expiresAt: string | null; outputName: string | null; sources: Source[]; downloadUrl: string | null; validationUrl: string | null };
const statuses: Record<string, string> = { QUEUED: "Na fila", RUNNING: "Em processamento", RETRY: "Nova tentativa agendada", BLOCKED: "Configuração necessária", FAILED: "Não concluído", SUCCEEDED: "Concluído", EXPIRED: "Expirado" };
export default function ProcessamentoPage() {
  const { user } = useSession(); const [jobs, setJobs] = useState<Job[]>([]), [sources, setSources] = useState<Source[]>([]), [selected, setSelected] = useState<Source[]>([]);
  const [files, setFiles] = useState<FileOption[]>([]), [fileIds, setFileIds] = useState<string[]>([]), [kind, setKind] = useState("PDF"), [selection, setSelection] = useState("custom");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [message, setMessage] = useState("");
  const [query, setQuery] = useState(""), [showNew, setShowNew] = useState(false), [textJob, setTextJob] = useState<Job>(), [textQuery, setTextQuery] = useState("");
  const [texts, setTexts] = useState<{ fileId: string; excerpt: string }[]>([]);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [jobQuery, setJobQuery] = useState(""), [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState({ key: "createdAt", desc: true }), [optionsTruncated, setOptionsTruncated] = useState(false);
  const [newStep, setNewStep] = useState<"settings" | "sources" | "files">("settings");
  const generation = useRef(0);
  const request = useRef<{ signature: string; key: string }>();
  const reload = useCallback(async () => {
    const version = ++generation.current;
    const params = new URLSearchParams({ page: String(page), q: jobQuery, sort: sort.key, desc: String(sort.desc), status: statusFilter });
    const result = await api(`/api/jobs?${params}`);
    if (version !== generation.current) return;
    setJobs(result.jobs); setTotal(result.total);
    if (page > Math.max(1, Math.ceil(result.total / 20))) setPage(Math.max(1, Math.ceil(result.total / 20)));
  }, [page, jobQuery, sort, statusFilter]);
  useEffect(() => {
    const epoch = generation;
    if (!user) { setLoading(false); return; }
    setLoading(true); void reload().catch(e => setError(e.message)).finally(() => setLoading(false));
    const timer = setInterval(() => { void reload().catch(e => setError(e.message)); }, 10000);
    return () => { epoch.current++; clearInterval(timer); };
  }, [user, reload]);
  useEffect(() => {
    if (!user || !showNew) return; let cancelled = false;
    const timer = setTimeout(() => { void api(`/api/jobs/options?q=${encodeURIComponent(query)}`).then(data => { if (!cancelled) { setSources(data.sources); setOptionsTruncated(data.truncated); } }).catch(e => { if (!cancelled) setError(e.message); }); }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [user, showNew, query]);
  async function toggle(source: Source) {
    if (selected.some(s => s.id === source.id)) { const removed = files.filter(f => f.sourceId === source.id).map(f => f.id); setSelected(s => s.filter(x => x.id !== source.id)); setFiles(f => f.filter(x => x.sourceId !== source.id)); setFileIds(ids => ids.filter(id => !removed.includes(id))); return; }
    setBusy(true);
    try { const data = await api(`/api/jobs/options?type=${source.type}&id=${source.id}`); setSelected(s => [...s, source]); setFiles(f => [...f, ...data.files.map((x: FileOption) => ({ ...x, sourceId: source.id }))]); setFileIds(ids => [...ids, ...data.files.map((x: FileOption) => x.id)]); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setError(undefined);
    const payload = { kind, selection, sources: selected.map(({ id, type }) => ({ id, type })), ...(selection === "custom" ? { fileIds } : {}) };
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    try {
      const data = await api("/api/jobs", { method: "POST", body: JSON.stringify({ ...payload, idempotencyKey: request.current!.key }) });
      setMessage(`Solicitação ${data.job.code} recebida.`); request.current = undefined; setShowNew(false); await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function download(job: Job, validation = false) {
    try {
      const path = validation ? job.validationUrl : job.downloadUrl;
      if (!path) throw new Error("Resultado indisponível ou expirado. Atualize a listagem.");
      const token = await getToken(); const response = await fetch(path, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error((await response.json()).error);
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = validation ? `${job.code}-verapdf.json` : job.outputName ?? job.code; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError((e as Error).message); }
  }
  async function searchText(job: Job, q = "") {
    try { const data = await api(`/api/jobs/${job.id}/text?q=${encodeURIComponent(q)}`); setTexts(data.results); setTextJob(job); } catch (e) { setError((e as Error).message); }
  }
  if (user === null) return <p>Entre na sua conta para acessar o processamento documental. <Link href="/admin">Entrar</Link></p>;
  if (textJob) return <DataTable id="jobs-text" title={`Texto extraído — ${textJob.code}`} rows={texts} rowKey={t => t.fileId} error={error}
    actions={<><button onClick={() => void download(textJob)}>Baixar texto integral</button><button onClick={() => setTextJob(undefined)}>Voltar à fila</button></>}
    filters={<form onSubmit={e => { e.preventDefault(); void searchText(textJob, textQuery); }}><label>Termos<input value={textQuery} maxLength={200} onChange={e => setTextQuery(e.target.value)} /></label><button>Buscar</button><p>Prévia de até 10.000 caracteres por anexo; texto integral disponível no download.</p></form>}
    columns={[{ key: "id", label: "Anexo", value: t => t.fileId }, { key: "text", label: "Conteúdo", value: t => t.excerpt }]} />;
  if (showNew && newStep === "sources") return <DataTable id="jobs-sources" title="Selecionar documentos" rows={sources} rowKey={s => `${s.type}:${s.id}`} error={error}
    actions={<><span>{selected.length} selecionado(s)</span><button disabled={busy} onClick={() => setNewStep("settings")}>Configuração</button><button disabled={busy || !selected.length} onClick={() => setNewStep(selection === "custom" ? "files" : "settings")}>Continuar</button></>}
    filters={<><label>Localizar no acervo<input value={query} onChange={e => setQuery(e.target.value)} /></label><p>{optionsTruncated ? "Há mais resultados autorizados. Refine a busca para localizar outros documentos." : "Opções carregadas para esta busca."} Limite de 100 opções por origem.</p></>}
    columns={[
      { key: "select", label: "Selecionar", value: s => selected.some(x => x.id === s.id) ? "Selecionado" : "", render: s => <input type="checkbox" aria-label={`Selecionar ${s.title}`} disabled={busy} checked={selected.some(x => x.id === s.id)} onChange={() => void toggle(s)} />, width: 90 },
      { key: "code", label: "Código", value: s => s.code ?? "—" }, { key: "title", label: "Assunto", value: s => s.title }, { key: "type", label: "Origem", value: s => s.type === "module" ? "Gestão municipal" : "Documento" },
    ]} />;
  if (showNew && newStep === "files") return <DataTable id="jobs-files" title="Selecionar anexos" rows={files} rowKey={f => f.id} error={error}
    actions={<><span>{fileIds.length} incluído(s)</span><button disabled={busy} onClick={() => setNewStep("sources")}>Documentos</button><button disabled={busy} onClick={() => setNewStep("settings")}>Confirmar seleção</button></>}
    columns={[
      { key: "select", label: "Incluir", value: f => fileIds.includes(f.id) ? "Incluído" : "", render: f => <input type="checkbox" aria-label={`Incluir ${f.filename}`} checked={fileIds.includes(f.id)} disabled={busy} onChange={() => setFileIds(ids => ids.includes(f.id) ? ids.filter(id => id !== f.id) : [...ids, f.id])} />, width: 90 },
      { key: "filename", label: "Arquivo", value: f => f.filename }, { key: "mime", label: "Formato", value: f => f.mimeType ?? "—" }, { key: "size", label: "Tamanho (bytes)", value: f => f.size ?? 0 },
    ]} />;
  if (showNew) return <div className="card"><h1>Nova solicitação</h1>{error && <p role="alert">{error}</p>}
      <label>Formato <select value={kind} disabled={busy} onChange={e => setKind(e.target.value)}><option value="PDF">PDF com layout e paginação</option><option value="PDFA">PDF/A-2b validado</option><option value="OCR">OCR e índice textual</option><option value="ZIP">ZIP de originais e manifesto</option></select></label>{" "}
      <label>Seleção <select value={selection} disabled={busy} onChange={e => setSelection(e.target.value)}><option value="custom">Personalizada</option><option value="complete">Completa: registros, vínculos e anexos</option></select></label>
      <p>PDF incorpora anexos PDF, PNG e JPEG. ZIP preserva os originais de todos os formatos. A seleção completa percorre os vínculos dos módulos e exige acesso a cada documento.</p>
      <p>{selected.length} documento(s) e {selection === "custom" ? `${fileIds.length} anexo(s)` : "todos os anexos dos vínculos"} selecionados.</p>
      <div className="form-row"><button className="btn" disabled={busy} onClick={() => setNewStep("sources")}>Selecionar documentos</button>{selection === "custom" && <button className="btn" disabled={busy || !selected.length} onClick={() => setNewStep("files")}>Selecionar anexos</button>}</div>
      <button className="btn btn-primary" disabled={busy || !selected.length} onClick={() => void submit()}>{busy ? "Aguarde…" : "Solicitar processamento"}</button>{" "}<button className="btn" disabled={busy} onClick={() => setShowNew(false)}>Fechar</button>
    </div>;
  return <DataTable id="document-jobs" title="Processamento documental" rows={jobs} rowKey={j => j.id} loading={loading} error={error}
      pagination={{ page, total, onPageChange: setPage }} onSearch={q => { setJobQuery(q); setPage(1); }} onSort={value => { setSort(value); setPage(1); }}
      filters={<label>Situação <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}><option value="">Todas</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      actions={<>{message && <span role="status">{message}</span>}<button className="btn btn-primary" onClick={() => { setNewStep("settings"); setShowNew(true); }}>Nova solicitação</button><button className="btn" onClick={() => void reload().catch(e => setError(e.message))}>Atualizar</button></>} columns={[
      { key: "code", label: "Código", value: j => j.code, width: 155 }, { key: "kind", label: "Formato", value: j => j.kind === "PDFA" ? "PDF/A-2b" : j.kind, width: 100 },
      { key: "status", label: "Situação", value: j => statuses[j.status] ?? j.status }, { key: "error", label: "Detalhes", value: j => j.error ?? j.sources.map(s => s.title).join("; ") },
      { key: "expires", label: "Disponível até", value: j => j.expiresAt ? new Date(j.expiresAt).toLocaleString("pt-BR") : "—" },
      { key: "actions", label: "Ações", value: j => j.status === "SUCCEEDED" ? "Baixar" : "", render: j => <>{j.status === "SUCCEEDED" && <><button onClick={() => void download(j)}>Baixar</button>{j.validationUrl && <button onClick={() => void download(j, true)}>Relatório veraPDF</button>}{j.kind === "OCR" && <button onClick={() => { setTextQuery(""); void searchText(j); }}>Consultar texto</button>}</>}{["FAILED", "BLOCKED"].includes(j.status) && <button onClick={() => void api(`/api/jobs/${j.id}`, { method: "POST" }).then(reload).catch(e => setError(e.message))}>Tentar novamente</button>}</> },
    ]} />;
}
