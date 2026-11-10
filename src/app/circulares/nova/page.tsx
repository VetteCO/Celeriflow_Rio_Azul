"use client";
// POC-06 — nova circular: tipo + múltiplos setores + rich text.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { RichText } from "@/components/RichText";

type Dept = { id: string; name: string; acronym: string | null; parentId?: string | null; active?: boolean };

export default function NovaCircular() {
  const { user, permissions } = useSession();
  const router = useRouter();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [myDepartmentIds, setMyDepartmentIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState("URGENT");
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
      if (raw) { const draft = JSON.parse(raw); setSubject(draft.subject ?? ""); setBody(draft.body ?? ""); setUrgency(draft.urgency ?? "URGENT"); setOrigin(draft.origin ?? ""); setIncludeSubdepartments(draft.includeSubdepartments === true); if (Array.isArray(draft.picked)) setPicked(draft.picked); setDraftNotice("Rascunho recuperado desta sessão do navegador."); }
    } catch { setDraftNotice("Não foi possível recuperar o rascunho local."); }
    setDraftReady(true);
  }, [user]);
  useEffect(() => {
    if (!user || !draftReady || saving) return;
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(`circular-draft:${user.uid}`, JSON.stringify({ subject, body, urgency, origin, picked, includeSubdepartments })); setDraftNotice("Rascunho salvo nesta sessão do navegador."); }
      catch { setDraftNotice("O armazenamento local está indisponível. Salve a circular para preservar o conteúdo."); }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [user, draftReady, saving, subject, body, urgency, origin, picked, includeSubdepartments]);

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

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

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
        <fieldset className="card plain">
          <legend>
            <strong>Setores destinatários ({picked.length})</strong>
          </legend>
          <label><input type="checkbox" checked={includeSubdepartments} onChange={(e) => setIncludeSubdepartments(e.target.checked)} /> Incluir os subsetores dos setores selecionados</label>
           {depts.filter((d) => d.active !== false).map((d) => (
            <label key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
              <input
                type="checkbox"
                style={{ width: "auto", minHeight: "auto" }}
                checked={picked.includes(d.id)}
                onChange={() => toggle(d.id)}
              />
               {d.parentId && `${depts.find((p) => p.id === d.parentId)?.name ?? "Setor superior"} / `}{d.name}{d.acronym ? ` (${d.acronym})` : ""}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="btn btn-primary" disabled={saving || picked.length === 0}>
          {saving ? "Enviando…" : `Enviar para ${picked.length} setor(es)`}
        </button>
      </form>
    </div>
  );
}
