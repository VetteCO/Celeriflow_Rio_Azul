"use client";
// POC-06 — nova circular: tipo + múltiplos setores + rich text.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { RichText } from "@/components/RichText";
import { DepartmentPicker } from "@/components/DepartmentPicker";

type Dept = { id: string; name: string; acronym: string | null; parentId?: string | null; active?: boolean };

export default function NovaCircular() {
  const { user, permissions } = useSession();
  const router = useRouter();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [myDepartmentIds, setMyDepartmentIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState("URGENT");
  const [circularReplyMode, setCircularReplyMode] = useState("OPEN");
  const [origin, setOrigin] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [includeSubdepartments, setIncludeSubdepartments] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  useEffect(() => {
    if (!user) return;
    try {
      const raw = sessionStorage.getItem(`circular-draft:${user.uid}`);
      if (raw) { const draft = JSON.parse(raw); setSubject(draft.subject ?? ""); setBody(draft.body ?? ""); setUrgency(draft.urgency ?? "URGENT"); setCircularReplyMode(draft.circularReplyMode === "RESTRICTED" ? "RESTRICTED" : "OPEN"); setOrigin(draft.origin ?? ""); setIncludeSubdepartments(draft.includeSubdepartments === true); if (Array.isArray(draft.picked)) setPicked(draft.picked); setDraftNotice("Rascunho recuperado desta sessão do navegador."); }
    } catch { setDraftNotice("Não foi possível recuperar o rascunho local."); }
    setDraftReady(true);
  }, [user]);
  useEffect(() => {
    if (!user || !draftReady || saving) return;
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(`circular-draft:${user.uid}`, JSON.stringify({ subject, body, urgency, circularReplyMode, origin, picked, includeSubdepartments })); setDraftNotice("Rascunho salvo nesta sessão do navegador."); }
      catch { setDraftNotice("O armazenamento local está indisponível. Salve a circular para preservar o conteúdo."); }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [user, draftReady, saving, subject, body, urgency, circularReplyMode, origin, picked, includeSubdepartments]);

  useEffect(() => {
    if (!user) return;
     api("/api/admin/departments")
       .then((d) => { setDepts(d.departments.filter((s: Dept) => s.active !== false)); setMyDepartmentIds(d.myDepartmentIds ?? []); })
      .catch((e) => setErr((e as Error).message));
  }, [user]);

  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user)
    return (
      <p>
        Faça login em <Link href="/admin">/admin</Link>.
      </p>
    );
   if (!permissions.includes("*") && !permissions.includes("doc:create"))
    return (
      <p className="alert alert-warn">
         Seu perfil permite consultar circulares. A criação está disponível aos servidores autorizados.
      </p>
    );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setErr(null);
    if (!body.replace(/<[^>]*>/g, "").trim()) { setErr("Preencha o conteúdo da circular."); return; }
    setSaving(true);
    try {
      const data = await api("/api/circulars", {
        method: "POST",
        body: JSON.stringify({
          subject,
          body,
           urgency,
           circularReplyMode,
          originDepartmentId: origin || null,
          departmentIds: picked,
          includeSubdepartments,
        }),
      });
       setDraftReady(false);
       try { sessionStorage.removeItem(`circular-draft:${user!.uid}`); } catch { /* Storage is optional. */ }
       router.push(`/circulares/${data.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Nova circular</h1>
      {draftNotice && <p role="status" className="muted">{draftNotice}</p>}
      {err && (
        <p className="alert alert-error" role="alert">
          {err}
        </p>
      )}
      <form onSubmit={save} className="form" style={{ maxWidth: 720 }}>
        <div className="form-row">
          <label style={{ flex: 1 }}>
            Tipo
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              <option value="URGENT">Urgente</option>
              <option value="INFORMATIVE">Meramente Informativa</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Origem
            <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value="">—</option>
               {depts.filter((d) => myDepartmentIds.includes(d.id)).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Assunto
          <input
            required
            name="subject"
            autoComplete="off"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label>
          Corpo
          <RichText value={body} onChange={setBody} />
        </label>
        {urgency === "URGENT" && <label>Respostas<select value={circularReplyMode} onChange={e => setCircularReplyMode(e.target.value)}><option value="OPEN">Abertas a todos os envolvidos</option><option value="RESTRICTED">Restritas ao setor remetente</option></select></label>}
        {urgency === "INFORMATIVE" && <p className="muted">Circular meramente informativa: os destinatários podem registrar leitura, sem responder ou encaminhar.</p>}
        <fieldset className="card plain">
          <legend>
            <strong>Setores destinatários ({picked.length})</strong>
          </legend>
          <label><input type="checkbox" checked={includeSubdepartments} onChange={(e) => setIncludeSubdepartments(e.target.checked)} /> Incluir os subsetores dos setores selecionados</label>
        </fieldset>
        <DepartmentPicker departments={depts} value={picked} onChange={setPicked} disabled={saving} />
        <button type="submit" className="btn btn-primary" disabled={saving || picked.length === 0}>
          {saving ? "Enviando…" : `Enviar para ${picked.length} setor(es)`}
        </button>
      </form>
    </div>
  );
}
