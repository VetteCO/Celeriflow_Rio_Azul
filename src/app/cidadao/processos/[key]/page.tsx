"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { externalError, externalRequest, useExternalAccount } from "../../conta/ExternalAccount";
type Detail = { protocolNumber: string; subject: string; description: string; status: string; history: Array<{ id: string; action: string; at: string; note: string | null }>; attachments: Array<{ id: string; filename: string; size: number | null; url: string }> };
export default function CitizenProcess() {
  const params = useParams<{ key: string }>();
  const { user, revision } = useExternalAccount();
  const [data, setData] = useState<Detail | null>(null); const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState("");
  const [view, setView] = useState("detail"); const [text, setText] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const endpoint = `/api/cidadao/requerimentos/${encodeURIComponent(params.key)}`;
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError(null);
    try { const response = await externalRequest(endpoint); const detail = await response.json(); if (current === generation.current) setData(detail); }
    catch (e) { if (current === generation.current) { setData(null); setError(externalError(e)); } }
    finally { if (current === generation.current) setLoading(false); }
  }, [endpoint]);
  useEffect(() => { const epoch = generation; setData(null); if (user?.emailVerified) void load(); return () => { epoch.current++; }; }, [user, revision, load]);
  async function complement(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null); setNotice("");
    try { await externalRequest(endpoint, { method: "POST", body: JSON.stringify({ text }) }); setText(""); setView("detail"); await load(); setNotice("Complementação registrada."); }
    catch (e) { setError(externalError(e)); } finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    if (file.size > 10 * 1024 * 1024) { setError("O arquivo deve ter no máximo 10 MB."); return; }
    setBusy(true); setError(null);
    try { const form = new FormData(); form.append("file", file); await externalRequest(`${endpoint}/attachments`, { method: "POST", body: form }); await load(); setNotice("Arquivo anexado ao protocolo."); }
    catch (e) { setError(externalError(e)); } finally { setBusy(false); if (uploadRef.current) uploadRef.current.value = ""; }
  }
  async function download(file: Detail["attachments"][number]) {
    if (busy) return; setBusy(true); setError(null);
    try {
      const response = await externalRequest(`${endpoint}/attachments/${encodeURIComponent(file.id)}`);
      const url = URL.createObjectURL(await response.blob()); const a = document.createElement("a"); a.href = url; a.download = file.filename; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(externalError(e)); } finally { setBusy(false); }
  }
  if (user === undefined) return <p role="status">Carregando conta…</p>;
  if (!user?.emailVerified) return <section className="card"><h1>Acompanhamento do requerente</h1><p>Entre com a conta de e-mail confirmado utilizada no requerimento para acessar este protocolo.</p><Link className="btn btn-primary" href="/cidadao/conta">Acessar minha conta</Link><Link className="btn" href="/cidadao">Portal do cidadão</Link></section>;
  if (!data) return <section className="card"><h1>Meu protocolo</h1>{loading ? <p role="status">Carregando protocolo…</p> : <><p role="alert" className="alert alert-error">{error}</p><button className="btn" onClick={load}>Tentar novamente</button></>}<Link className="btn" href="/cidadao/conta">Minha caixa</Link></section>;
  const open = ["OPEN", "IN_TRANSIT"].includes(data.status);
  const tabs = <><Link className="btn" href="/cidadao/conta">Minha caixa</Link><button className="btn" aria-pressed={view === "detail"} onClick={() => setView("detail")}>Dados e andamento</button><button className="btn" aria-pressed={view === "files"} onClick={() => setView("files")}>Anexos</button>{open && <button className="btn" aria-pressed={view === "complement"} onClick={() => setView("complement")}>Complementar</button>}</>;
  if (view === "files") return <DataTable id="citizen-files" title={`Anexos — ${data.protocolNumber}`} rows={data.attachments} rowKey={(f) => f.id} error={error} loading={loading}
    actions={<>{tabs}{open && <><button className="btn btn-primary" disabled={busy} onClick={() => uploadRef.current?.click()}>{busy ? "Aguarde…" : "Anexar arquivo"}</button><input ref={uploadRef} type="file" hidden onChange={(e) => upload(e.target.files?.[0])} /></>}</>}
    columns={[{ key: "name", label: "Arquivo", value: (f) => f.filename }, { key: "size", label: "Tamanho (KB)", value: (f) => f.size === null ? "—" : Math.ceil(f.size / 1024), align: "right" }, { key: "action", label: "Ação", value: () => "Baixar", render: (f) => <button className="btn" disabled={busy} onClick={() => download(f)}>Baixar</button> }]} />;
  return <section><div className="form-row" aria-label="Navegação do protocolo">{tabs}</div><h1>{data.protocolNumber} — {data.subject}</h1>{error && <p role="alert" className="alert alert-error">{error}</p>}{notice && <p role="status" className="alert alert-ok">{notice}</p>}
    {view === "complement" ? <form className="form card" onSubmit={complement}><h2>Complementar requerimento</h2><label>Informações adicionais<textarea required minLength={3} maxLength={20000} rows={8} value={text} onChange={(e) => setText(e.target.value)} /></label><button className="btn btn-primary" disabled={busy || !open}>{busy ? "Registrando…" : "Registrar complementação"}</button></form> : <><p>Situação: {data.status}</p><section className="card"><h2>Descrição do requerimento</h2><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{data.description}</p></section><h2>Andamento e respostas</h2><ol className="timeline">{data.history.map((event) => <li key={event.id}><strong>{event.action}</strong><div className="t-meta">{new Date(event.at).toLocaleString("pt-BR")}</div>{event.note && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{event.note}</p>}</li>)}</ol>{!open && <p>Este protocolo está encerrado para novas complementações e anexos.</p>}</>}
  </section>;
}
