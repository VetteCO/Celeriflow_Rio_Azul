"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { externalRequest } from "@/app/cidadao/conta/ExternalAccount";
import { AccountRequired, externalDownload, externalJson, useExternalAccount } from "../client";
import { WorkflowFormFields } from "@/components/WorkflowFormFields";
import { WorkflowFieldsEditor } from "@/components/WorkflowFieldsEditor";
import type { Field } from "@/lib/modules/domain";
type ExternalDetail = { record: { id: string; code: string; title: string; body: string; status: string; revision: number; dueAt?: string; step?: string; requiredFiles: string[]; values: Record<string, string>; fields: Field[]; editableFields: string[]; messages: { text: string; at: string; source: string }[]; evaluation?: { score: number; comment: string } }; files: { id: string; filename: string; category: string; size: number }[]; reviews: { fileId: string; status: string; note: string; at: string }[] };
export default function ExternalProcess() {
  const params = useParams<{ id: string }>();
  const { user, revision } = useExternalAccount(); const [detail, setDetail] = useState<ExternalDetail>(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [text, setText] = useState(""); const [score, setScore] = useState(5); const [file, setFile] = useState<File>(); const [category, setCategory] = useState("Anexo"); const [tab, setTab] = useState("atendimento");
  const load = useCallback(async () => setDetail(await externalJson(`/api/modules/external/${params.id}`)), [params.id]);
  useEffect(() => { if (user?.emailVerified) load().catch(e => setError(e.message)); }, [user, revision, load]);
  async function act(action: string) { if (!detail) return; setBusy(true); setError(""); try { await externalJson(`/api/modules/external/${params.id}`, { method: "PATCH", body: JSON.stringify({ action, revision: detail.record.revision, text, score }) }); setText(""); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  if (!user?.emailVerified) return <AccountRequired />;
  if (!detail) return <p role={error ? "alert" : "status"}>{error || "Carregando atendimento…"}</p>;
  const r = detail.record; const open = ["RASCUNHO", "EM_ANDAMENTO"].includes(r.status);
  if (tab === "anexos") return <DataTable id="external-module-files" title={`Anexos — ${r.code}`} rows={detail.files} rowKey={f => f.id} error={error} actions={<button className="btn" onClick={() => setTab("atendimento")}>Voltar ao atendimento</button>} columns={[
    { key: "filename", label: "Arquivo", value: f => f.filename, render: f => <button className="btn" onClick={() => externalDownload(`/api/modules/external/${r.id}/files/${f.id}`, f.filename).catch(e => setError(e.message))}>{f.filename}</button> }, { key: "category", label: "Categoria", value: f => f.category }, { key: "status", label: "Revisão", value: f => [...detail.reviews].reverse().find(v => v.fileId === f.id)?.status ?? "PENDENTE" }, { key: "note", label: "Observação", value: f => [...detail.reviews].reverse().find(v => v.fileId === f.id)?.note ?? "" },
  ]} />;
  return <section className="card"><Link href="/gestao/central">Meus atendimentos</Link><h1>{r.title}</h1><p><strong>{r.code}</strong> — {r.status.replaceAll("_", " ")}</p>{error && <p role="alert">{error}</p>}<p style={{ whiteSpace: "pre-wrap" }}>{r.body}</p><p>Etapa: {r.step ?? "Recebimento"}. Prazo: {r.dueAt ? new Date(r.dueAt).toLocaleString("pt-BR") : "Após protocolização"}.</p><button className="btn" onClick={() => setTab("anexos")}>Consultar anexos e revisões ({detail.files.length})</button>
    {open && <fieldset><legend>Complementar documentos</legend><label>Arquivo<input type="file" accept=".pdf,.dwg,.png,.jpg,.jpeg,.txt" onChange={e => setFile(e.target.files?.[0])} /></label><label>Categoria<input list="external-categories" value={category} onChange={e => setCategory(e.target.value)} /><datalist id="external-categories">{r.requiredFiles.map(c => <option key={c}>{c}</option>)}</datalist></label><button disabled={busy || !file} className="btn" onClick={async () => { if (!file) return; setBusy(true); setError(""); try { const form = new FormData(); form.append("file", file); form.append("category", category); await externalRequest(`/api/modules/external/${r.id}/files`, { method: "POST", body: form }); await load(); setFile(undefined); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Enviar arquivo</button>{!!r.requiredFiles.length && <p>Obrigatórios: {r.requiredFiles.join(", ")}</p>}</fieldset>}
    {r.fields?.length > 0 && <WorkflowFormFields fields={r.fields} values={r.values} onChange={() => {}} channel="EXTERNO" readOnly />}
    {!!r.editableFields?.length && <WorkflowFieldsEditor key={r.revision} fields={r.fields} initialValues={r.values} channel="EXTERNO" afterProtocol={r.status !== "RASCUNHO"} busy={busy} onSave={async values => { await externalJson(`/api/modules/external/${r.id}`, { method: "PATCH", body: JSON.stringify({ action: "EDITAR_CAMPOS", revision: r.revision, values }) }); await load(); }} />}
    {r.status === "RASCUNHO" && <button disabled={busy} className="btn btn-primary" onClick={() => act("PROTOCOLAR")}>Protocolar solicitação</button>}
    <h2>Acompanhamento</h2>{r.messages.map((m, i) => <article key={i}><strong>{m.source}</strong> · {new Date(m.at).toLocaleString("pt-BR")}<p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p></article>)}
    {r.status === "EM_ANDAMENTO" && <fieldset><legend>Responder ao atendimento</legend><textarea aria-label="Resposta" rows={5} value={text} onChange={e => setText(e.target.value)} /><button disabled={busy || !text.trim()} className="btn btn-primary" onClick={() => act("RESPONDER")}>Enviar resposta</button></fieldset>}
    {["DEFERIDO", "INDEFERIDO", "CONCLUIDO", "ARQUIVADO"].includes(r.status) && <fieldset><legend>Avaliar atendimento concluído</legend>{r.evaluation && <p>Avaliação atual: {r.evaluation.score}/5 — {r.evaluation.comment}</p>}<label>Nota<select value={score} onChange={e => setScore(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} de 5</option>)}</select></label><label>Comentário<textarea value={text} onChange={e => setText(e.target.value)} /></label><button disabled={busy} className="btn" onClick={() => act("AVALIAR")}>Registrar avaliação</button></fieldset>}
  </section>;
}
