"use client";
// POC-05 — detalhe + timeline cronológica + tramitar + receber + prazos + anexos.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { api, getToken, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";

type Detail = {
  document: {
    id: string;
    displayNumber: string;
    sequentialNumber: number;
    year: number;
    subject: string;
    body: string;
    status: string;
    origin: string;
    createdAt: string;
    publicKey: string;
    type: string;
    accessLevel: string;
    urgency?: string;
    assigneeId?: string | null;
    assignee?: string;
    circularReplyMode?: string;
  };
  deadlines: Array<{ id: string; title: string; dueAt: string; status: string }>;
  timeline: Array<{
    id: string;
    action: string;
    from: string;
    to: string;
    note: string | null;
     actor: string;
     actorPhoto?: string | null;
    at: string;
  }>;
  attachments: Array<{ id: string; filename: string; url: string; size: number | null; citizenVisible?: boolean; downloads?: number }>;
  departments: Array<{ id: string; name: string; acronym: string | null; active?: boolean }>;
  participation?: Array<{ departmentId: string; state: string }>;
};

export default function DocDetail() {
  const params = useParams<{ id: string }>();
  const { user, permissions } = useSession();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toDept, setToDept] = useState("");
  const [copyDepartments, setCopyDepartments] = useState<string[]>([]);
  const [attachmentPreview, setAttachmentPreview] = useState(false);
  const [note, setNote] = useState("");
  const [nTitle, setNTitle] = useState("");
  const [nDue, setNDue] = useState("");
  const [visibility, setVisibility] = useState("INTERNAL");
  const [actingDepartment, setActingDepartment] = useState("");
  const [view, setView] = useState("document");
  const [editingDeadline, setEditingDeadline] = useState<string | null>(null);
  const [deadlineStatus, setDeadlineStatus] = useState("PENDING");
  const [myDepartmentIds, setMyDepartmentIds] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string }>>([]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [deadlineFilter, setDeadlineFilter] = useState("");
  const [busy, setBusy] = useState<"forward" | "receive" | "deadline" | null>(null);
  const allowed = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const canEdit = allowed("doc:edit");

  const load = useCallback(() => {
    Promise.all([api(`/api/documents/${params.id}`), api("/api/admin/departments"), api("/api/admin/me")])
      .then(async ([detail, departments, account]) => {
         if (detail.document.type === "CIRCULAR") { const circular = await api(`/api/circulars/${params.id}`); detail.document.urgency = circular.circular.urgency; }
         if (detail.document.type === "EXTERNAL_REQUEST") { const assignment = await api(`/api/documents/${params.id}/assignment`); setAssignees(assignment.users); }
        setData(detail); setMyDepartmentIds(departments.myDepartmentIds ?? []); setErr(null); setAttachmentPreview(account.profile?.details?.attachmentView === "PREVIA");
      })
      .catch((e) => setErr((e as Error).message));
  }, [params.id]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user)
   return (
      <p>
        Faça login em <Link href="/admin">/admin</Link>.
      </p>
    );
  if (err && !data)
    return (
      <p className="alert alert-error" role="alert">
        {err}
      </p>
    );
  if (!data) return <p role="status">Carregando documento…</p>;
  const sectorState = data.participation?.find((p) => p.departmentId === (actingDepartment || myDepartmentIds[0]))?.state;
  const canEditActivities = canEdit && data.participation?.some(p => myDepartmentIds.includes(p.departmentId) && ["OPEN", "PENDING"].includes(p.state));

  async function forward() {
    if (busy) return;
    setErr(null);
    setBusy("forward");
    try {
      await api(`/api/documents/${params.id}/forward`, {
        method: "POST",
         body: JSON.stringify({ toDepartmentId: toDept || undefined, toDepartmentIds: copyDepartments, departmentId: actingDepartment || undefined, note, visibility: "INTERNAL" }),
      });
      setNote("");
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
   async function download(id: string, filename: string, preview = false) {
      setErr(null);
      const target = preview ? window.open("about:blank", "_blank") : null;
      if (target) target.opener = null;
     try {
       const token = await getToken();
       if (!token) throw new Error("Entre novamente para baixar o arquivo.");
       const response = await fetch(`/api/attachments/${id}`, { headers: { authorization: `Bearer ${token}` } });
       if (!response.ok) throw new Error("Não foi possível baixar o anexo.");
        const url = URL.createObjectURL(await response.blob());
        if (target && /^(application\/pdf|image\/(png|jpeg|webp))(;|$)/i.test(response.headers.get("content-type") ?? "")) { target.location.href = url; window.setTimeout(() => URL.revokeObjectURL(url), 60000); return; }
        target?.close();
       const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
       document.body.appendChild(anchor); anchor.click(); anchor.remove();
       window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (e) { target?.close(); setErr((e as Error).message); }
   }
  async function receive() {
    if (busy) return;
    setErr(null);
    setBusy("receive");
    try {
       await api(`/api/documents/${params.id}/receive`, { method: "POST", body: JSON.stringify({ departmentId: actingDepartment || undefined }) });
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function addDeadline() {
    if (busy) return;
    setErr(null);
    setBusy("deadline");
    try {
       await api(editingDeadline ? `/api/deadlines/${editingDeadline}` : `/api/documents/${params.id}/deadlines`, {
         method: editingDeadline ? "PATCH" : "POST",
         body: JSON.stringify({ title: nTitle, dueAt: new Date(nDue).toISOString(), ...(editingDeadline ? { status: deadlineStatus } : {}) }),
      });
      setNTitle("");
       setNDue("");
       setEditingDeadline(null);
       setView("deadlines");
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function action(action: string) {
    if (busy || (action === "reply" && !note.trim())) return;
    setBusy("forward"); setErr(null);
    try {
      await api(`/api/documents/${params.id}/actions?action=${action}`, { method: "POST", body: JSON.stringify({ note, visibility, departmentId: actingDepartment || undefined }) });
      setNote(""); load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function upload(file: File) {
    if (busy) return;
    if (file.size > 10 * 1024 * 1024) { setErr("O arquivo deve ter no máximo 10 MB."); return; }
    setBusy("forward");
    setErr(null);
    try {
      const idToken = await getToken();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/documents/${params.id}/attachments`, {
        method: "POST",
        headers: idToken ? { authorization: `Bearer ${idToken}` } : {},
        body: form,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `http_${res.status}`);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null); if (uploadRef.current) uploadRef.current.value = "";
    }
  }
  async function releaseFile(id: string, citizenVisible: boolean) {
    if (busy) return; setBusy("forward"); setErr(null);
    try { await api(`/api/attachments/${id}`, { method: "PATCH", body: JSON.stringify({ citizenVisible }) }); setData((current) => current ? { ...current, attachments: current.attachments.map((a) => a.id === id ? { ...a, citizenVisible } : a) } : current); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function assign(assigneeId: string) {
    if (busy) return; setBusy("forward"); setErr(null);
    try { await api(`/api/documents/${params.id}/assignment`, { method: "PATCH", body: JSON.stringify({ assigneeId: assigneeId || null, departmentId: actingDepartment || undefined }) }); load(); }
    catch (error) { setErr((error as Error).message); } finally { setBusy(null); }
  }
  const navigation = <><Link className="btn" href="/documentos">Documentos</Link><button className="btn" aria-pressed={view === "document"} onClick={() => setView("document")}>Documento</button><button className="btn" aria-pressed={view === "deadlines"} onClick={() => setView("deadlines")}>Prazos</button><button className="btn" aria-pressed={view === "attachments"} onClick={() => setView("attachments")}>Anexos</button></>;

    if (view === "attachments") return <DataTable id="document-attachments" title={`Anexos — ${data.document.displayNumber}`} rows={data.attachments} rowKey={(a) => a.id} error={err} actions={<>{navigation}{canEditActivities && <><button className="btn btn-primary" disabled={!!busy} onClick={() => uploadRef.current?.click()}>Anexar arquivo</button><input type="file" hidden ref={uploadRef} onChange={(e) => { if (e.target.files?.[0]) void upload(e.target.files[0]); }} /></>}</>} columns={[
      { key: "name", label: "Arquivo", value: (a) => a.filename }, { key: "size", label: "Tamanho (KB)", value: (a) => a.size === null ? "—" : Math.ceil(a.size / 1024), align: "right" }, { key: "download", label: "Ação", value: () => attachmentPreview ? "Prévia / Baixar" : "Baixar", render: (a) => <>{attachmentPreview && /\.(pdf|png|jpe?g|webp)$/i.test(a.filename) && <button className="btn" onClick={() => download(a.id, a.filename, true)}>Prévia</button>}<button className="btn" onClick={() => download(a.id, a.filename)}>Baixar</button></> },
      { key: "visibility", label: "Acesso do requerente", value: (a) => a.citizenVisible === undefined ? "Não informado" : a.citizenVisible ? "Liberado" : "Interno", render: (a) => canEditActivities && data.document.type === "EXTERNAL_REQUEST" ? <select aria-label={`Acesso do requerente ao arquivo ${a.filename}`} value={a.citizenVisible === undefined ? "" : String(a.citizenVisible)} disabled={!!busy} onChange={(e) => releaseFile(a.id, e.target.value === "true")}><option value="" disabled>Selecionar</option><option value="false">Interno</option><option value="true">Liberado ao requerente</option></select> : a.citizenVisible === undefined ? "Não informado" : a.citizenVisible ? "Liberado" : "Interno" },
      { key: "downloads", label: "Downloads", value: a => a.downloads ?? 0 },
   ]} />;
    if (view === "deadlines") return <DataTable id="document-deadlines" title={`Prazos — ${data.document.displayNumber}`} rows={data.deadlines.filter((d) => !deadlineFilter || d.status === deadlineFilter)} rowKey={(d) => d.id} error={err} actions={<>{navigation}<Link className="btn" href="/calendario">Calendário</Link>{canEditActivities && <button className="btn btn-primary" onClick={() => { setEditingDeadline(null); setNTitle(""); setNDue(""); setView("deadline-form"); }}>Novo prazo</button>}</>} filters={<label>Situação<select value={deadlineFilter} onChange={(e) => setDeadlineFilter(e.target.value)}><option value="">Todas</option><option value="PENDING">Pendente</option><option value="COMPLETED">Concluído</option><option value="CANCELLED">Cancelado</option></select></label>} columns={[
     { key: "title", label: "Atividade", value: (d) => d.title }, { key: "due", label: "Vencimento", value: (d) => new Date(d.dueAt).toLocaleString("pt-BR") }, { key: "status", label: "Situação", value: (d) => d.status },
       { key: "actions", label: "Ação", value: () => canEditActivities ? "Editar" : "—", render: (d) => canEditActivities ? <button className="btn" onClick={() => { setEditingDeadline(d.id); setNTitle(d.title); const date = new Date(d.dueAt); setNDue(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); setDeadlineStatus(d.status); setView("deadline-form"); }}>Editar</button> : "—" },
   ]} />;
    if (view === "deadline-form" && canEditActivities) return <section className="card"><h1>{editingDeadline ? "Editar prazo" : "Novo prazo"}</h1>{err && <p role="alert" className="alert alert-error">{err}</p>}<form className="form" onSubmit={(e) => { e.preventDefault(); void addDeadline(); }}><label>Título<input required maxLength={200} value={nTitle} onChange={(e) => setNTitle(e.target.value)} /></label><label>Vencimento<input required type="datetime-local" value={nDue} onChange={(e) => setNDue(e.target.value)} /></label>{editingDeadline && <label>Situação<select value={deadlineStatus} onChange={(e) => setDeadlineStatus(e.target.value)}><option value="PENDING">Pendente</option><option value="COMPLETED">Concluído</option><option value="CANCELLED">Cancelado</option></select></label>}<div className="form-row"><button className="btn btn-primary" disabled={!!busy}>{busy ? "Salvando…" : "Salvar prazo"}</button><button type="button" className="btn" disabled={!!busy} onClick={() => setView("deadlines")}>Voltar aos prazos</button></div></form></section>;
   return (
     <div>
       <div className="form-row" aria-label="Navegação do documento">{navigation}</div>
      <h1>
        {data.document.displayNumber} — {data.document.subject}
      </h1>
      <p>
        <span className={`badge badge-${data.document.status}`}>{data.document.status}</span>{" "}
       <span className="muted">
         Sequência documental: {data.document.sequentialNumber}/{data.document.year} ·
          Origem: {data.document.origin} · Criado em{" "}
          {new Date(data.document.createdAt).toLocaleString("pt-BR")}
        </span>
      </p>
       <div className="doc-body" dangerouslySetInnerHTML={{ __html: data.document.body }} />
       {data.document.type === "EXTERNAL_REQUEST" && <section className="card plain"><h2>Atendimento ao cidadão</h2><p>Responsável: {data.document.assignee ?? "Sem responsável individual"}</p>{canEditActivities && <label>Atribuir responsável<select value={data.document.assigneeId ?? ""} disabled={!!busy} onChange={e => assign(e.target.value)}><option value="">Sem responsável individual</option>{assignees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}<p className="muted">Notas internas ficam no atendimento. Use “Resposta ao cidadão” para liberar o texto à conta do requerente.</p></section>}
       {data.document.type === "CIRCULAR" && <p>{data.document.urgency === "INFORMATIVE" ? "Meramente Informativa — sem respostas ou encaminhamento." : data.document.circularReplyMode === "RESTRICTED" ? "Respostas restritas ao setor remetente." : "Respostas abertas a todos os envolvidos."}</p>}
       {data.document.accessLevel === "PUBLIC" && <p><Link href={`/publico/${data.document.publicKey}`}>Consulta pública / QR →</Link></p>}
      {err && (
        <p className="alert alert-error" role="alert">
          {err}
        </p>
      )}

       <p>{data.deadlines.length} prazo(s) · {data.attachments.length} anexo(s) · <Link href={`/arvore?type=document&id=${params.id}`}>Árvore processual e anexos unificados</Link></p>

      <h3>Tramitação</h3>
      {data.participation && <ul>{data.participation.map((p) => <li key={p.departmentId}>{data.departments.find((d) => d.id === p.departmentId)?.name ?? "Setor"}: {p.state}</li>)}</ul>}
      <div className="card plain">
        {canEdit && <label>Atuar pelo setor<select value={actingDepartment} onChange={(e) => setActingDepartment(e.target.value)}><option value="">Meu setor principal</option>{data.participation?.filter((p) => myDepartmentIds.includes(p.departmentId)).map((p) => <option key={p.departmentId} value={p.departmentId}>{data.departments.find((d) => d.id === p.departmentId)?.name ?? p.departmentId}</option>)}</select></label>}
        <div className="form-row">
          {canEdit && (
            <>
              <select
                style={{ flex: 1 }}
                value={toDept}
                onChange={(e) => setToDept(e.target.value)}
                aria-label="Setor de destino"
              >
                <option value="">destino…</option>
                 {data.departments.filter((d) => d.active !== false && d.id !== (actingDepartment || myDepartmentIds[0])).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
               </select>
               <label>Cópia para setores<select multiple value={copyDepartments} onChange={e => setCopyDepartments(Array.from(e.target.selectedOptions).map(option => option.value))}>{data.departments.filter(d => d.active !== false && d.id !== (actingDepartment || myDepartmentIds[0]) && d.id !== toDept).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
               <textarea
                style={{ flex: 2 }}
                placeholder="despacho"
                aria-label="Texto do despacho"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={forward}
                 disabled={!allowed("doc:forward") || (!toDept && !copyDepartments.length) || busy !== null || sectorState !== "OPEN" || data.document.urgency === "INFORMATIVE"}
              >
                {busy === "forward" ? "Despachando…" : "Despachar"}
              </button>
            </>
          )}
           {allowed("doc:receive") && <button className="btn" onClick={receive} disabled={busy !== null || sectorState !== "PENDING"}>
             {busy === "receive" ? "Registrando…" : "Marcar recebido"}
           </button>}
         </div>
         {canEdit && <div className="form-row"><label>Visibilidade da resposta<select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="INTERNAL">Nota interna</option>{data.document.type === "EXTERNAL_REQUEST" && <option value="CITIZEN">Resposta ao cidadão</option>}</select></label><button className="btn" disabled={!!busy || !note.trim() || sectorState !== "OPEN" || data.document.urgency === "INFORMATIVE"} onClick={() => action("reply")}>Registrar resposta</button>
           {allowed("doc:conclude") && <button className="btn" disabled={!!busy || sectorState !== "OPEN"} onClick={() => action("conclude")}>Concluir no setor</button>}{allowed("doc:archive") && <button className="btn" disabled={!!busy || sectorState !== "CONCLUDED"} onClick={() => action("archive")}>Arquivar no setor</button>}{allowed("doc:reopen") && <button className="btn" disabled={!!busy || !["CONCLUDED", "ARCHIVED"].includes(sectorState ?? "")} onClick={() => action("reopen")}>Reabrir no setor</button>}
         </div>}
      </div>

      <h3>Linha do tempo</h3>
      <ol className="timeline">
        {data.timeline.map((t) => (
           <li key={t.id}>
             {t.actorPhoto && <Image unoptimized src={t.actorPhoto} alt={`Foto de ${t.actor}`} width={32} height={32} />}
            <span className="t-action">{t.action}</span>
            <div className="t-meta">
              {t.from} → {t.to} · por {t.actor} ·{" "}
              {new Date(t.at).toLocaleString("pt-BR")}
            </div>
            {t.note && <div className="t-note">{t.note}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
