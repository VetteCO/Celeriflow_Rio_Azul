"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { api, useSession } from "@/components/session";
import { Signers, type SignerInput } from "../Signers";
import type { Options } from "../client";
type Row = { id: string; code: string; title: string; revision: number; status: string; signatures: { userId: string; order: number; status: string }[] };
export default function SignatureQueue() {
  const { user } = useSession(); const [rows, setRows] = useState<Row[]>([]), [options, setOptions] = useState<Options>(), [selected, setSelected] = useState<string[]>([]);
  const [signers, setSigners] = useState<SignerInput[]>([{ userId: "", order: 1 }]), [note, setNote] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [mode, setMode] = useState(false), [writable, setWritable] = useState(false);
  const [results, setResults] = useState<{ id: string; code: string; saved: boolean; error?: string }[]>([]); const writing = useRef(false);
  const load = useCallback(async () => { const [queue, opts] = await Promise.all([api("/api/modules/signatures"), api("/api/modules/options")]); setRows(queue.records); setWritable(queue.writable); setOptions(opts); }, []);
  useEffect(() => { if (user) void load().catch(e => setError(e.message)); }, [user, load]);
  async function submit(action: string) {
    if (writing.current) return; writing.current = true; setBusy(true); setError("");
    try {
      const result = await api("/api/modules/signatures", { method: "POST", body: JSON.stringify({ action, records: rows.filter(r => selected.includes(r.id)).map(({ id, revision }) => ({ id, revision })), ...(action === "SOLICITAR_ASSINATURA" ? { signers } : {}), note }) });
      setResults(result.results.map((r: { id: string; saved: boolean; error?: string }) => ({ ...r, code: rows.find(row => row.id === r.id)?.code ?? r.id })));
      setSelected(result.results.filter((r: { saved: boolean }) => !r.saved).map((r: { id: string }) => r.id)); await load();
    } catch (e) { setError((e as Error).message); } finally { writing.current = false; setBusy(false); }
  }
  if (mode) return <section className="card"><h1>Operações de assinatura em lote</h1><button className="btn" onClick={() => setMode(false)}>Voltar à fila</button><p>{selected.length} documento(s) selecionado(s). A execução criptográfica depende da integração de assinatura.</p>{error && <p role="alert">{error}</p>}<Signers value={signers} onChange={setSigners} users={options?.users ?? []} disabled={busy} /><label>Justificativa<textarea value={note} onChange={e => setNote(e.target.value)} /></label><div className="form-row">{[["SOLICITAR_ASSINATURA", "Solicitar assinaturas"], ["RECUSAR_ASSINATURA", "Recusar minhas solicitações"], ["CANCELAR_ASSINATURAS", "Cancelar solicitações que enviei"]].map(([action, label]) => <button className="btn" key={action} disabled={busy || !selected.length || note.trim().length < 3} onClick={() => void submit(action)}>{label}</button>)}</div><h2>Resultado por documento</h2>{results.map(r => <p key={r.id}>{r.code}: {r.saved ? "Operação registrada" : r.error}</p>)}</section>;
  return <DataTable id="module-signatures" title="Fila de assinaturas" rows={rows} rowKey={r => r.id} error={error} actions={<><Link className="btn" href="/gestao">Módulos</Link>{writable && <button className="btn" disabled={!selected.length} onClick={() => setMode(true)}>Operar selecionados ({selected.length})</button>}</>} columns={[
    { key: "selection", label: "Selecionar", value: r => selected.includes(r.id) ? "Selecionado" : "", render: r => writable ? <input type="checkbox" aria-label={`Selecionar ${r.code}`} checked={selected.includes(r.id)} onChange={e => setSelected(current => e.target.checked ? [...current, r.id] : current.filter(id => id !== r.id))} /> : "—", width: 90 },
    { key: "code", label: "Código", value: r => r.code, render: r => <Link href={`/gestao/registros/${r.id}`}>{r.code}</Link>, width: 170 }, { key: "title", label: "Assunto", value: r => r.title },
    { key: "status", label: "Situação", value: r => r.signatures.length ? [...new Set(r.signatures.map(s => s.status))].join(", ") : "Sem solicitação" },
    { key: "signers", label: "Assinantes e etapas", value: r => r.signatures.map(s => `${s.order}. ${options?.users.find(u => u.id === s.userId)?.name ?? "Servidor"} — ${s.status}`).join("; ") },
  ]} />;
}
