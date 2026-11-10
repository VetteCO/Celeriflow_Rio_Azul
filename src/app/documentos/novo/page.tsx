"use client";
// POC-04 — novo memorando: assunto + rich text + origem/destino + prazos múltiplos.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { RichText } from "@/components/RichText";

type Dept = { id: string; name: string; acronym: string | null; active?: boolean };

export default function NovoMemorando() {
  const { user, permissions } = useSession();
  const router = useRouter();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [myDepartmentIds, setMyDepartmentIds] = useState<string[]>([]);
  const [docType, setDocType] = useState("MEMORANDUM");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [deadlines, setDeadlines] = useState<Array<{ title: string; dueAt: string }>>([
    { title: "", dueAt: "" },
    { title: "", dueAt: "" },
  ]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [accessLevel, setAccessLevel] = useState("INTERNAL");

  useEffect(() => {
    if (!user) return;
    try {
      const raw = sessionStorage.getItem(`document-draft:${user.uid}`);
      if (raw) {
        const draft = JSON.parse(raw);
        setSubject(draft.subject ?? ""); setBody(draft.body ?? ""); setDocType(draft.docType ?? "MEMORANDUM");
        setOrigin(draft.origin ?? ""); setDest(draft.dest ?? ""); setAccessLevel(draft.accessLevel ?? "INTERNAL");
        if (Array.isArray(draft.deadlines)) setDeadlines(draft.deadlines);
        setDraftNotice("Rascunho recuperado desta sessão do navegador.");
      }
    } catch { setDraftNotice("Não foi possível recuperar o rascunho local."); }
    setDraftReady(true);
  }, [user]);
  useEffect(() => {
    if (!user || !draftReady || saving) return;
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(`document-draft:${user.uid}`, JSON.stringify({ subject, body, docType, origin, dest, deadlines, accessLevel })); setDraftNotice("Rascunho salvo nesta sessão do navegador."); }
      catch { setDraftNotice("O armazenamento local está indisponível. Salve o documento para preservar o conteúdo."); }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [user, draftReady, saving, subject, body, docType, origin, dest, deadlines, accessLevel]);

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
         Seu perfil permite consultar documentos. A criação está disponível aos servidores autorizados.
      </p>
    );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setErr(null);
    if (deadlines.some((d) => !!d.title !== !!d.dueAt)) { setErr("Informe o título e a data de cada prazo, ou deixe ambos vazios."); return; }
    if (!body.replace(/<[^>]*>/g, "").trim()) { setErr("Preencha o conteúdo do documento."); return; }
    setSaving(true);
    try {
      const data = await api("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          type: docType,
          subject,
          body,
          accessLevel,
          originDepartmentId: origin || null,
          toDepartmentId: dest || null,
          deadlines: deadlines
            .filter((d) => d.title && d.dueAt)
            .map((d) => ({ title: d.title, dueAt: new Date(d.dueAt).toISOString() })),
        }),
      });
       setDraftReady(false);
       try { sessionStorage.removeItem(`document-draft:${user!.uid}`); } catch { /* Storage is optional. */ }
       router.push(`/documentos/${data.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Novo documento</h1>
      {draftNotice && <p role="status" className="muted">{draftNotice}</p>}
      {err && (
        <p className="alert alert-error" role="alert">
          {err}
        </p>
      )}
      <form onSubmit={save} className="form" style={{ maxWidth: 720 }}>
        <label>
          Tipo de documento
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="MEMORANDUM">Memorando (MEM)</option>
            <option value="OFICIO">Ofício eletrônico (OFI)</option>
          </select>
        </label>
        <label>
          Classificação de acesso
          <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)}><option value="INTERNAL">Interno</option><option value="PUBLIC">Público</option><option value="CONFIDENTIAL">Sigiloso</option></select>
        </label>
        <label>
          Assunto
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            name="subject"
            autoComplete="off"
          />
        </label>
        <label>
          Corpo (editor da plataforma)
          <RichText value={body} onChange={setBody} />
        </label>
        <div className="form-row">
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
          <label style={{ flex: 1 }}>
            Destino
            <select value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">—</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="card plain">
          <legend>
            <strong>Prazos (múltiplos, calendário)</strong>
          </legend>
          {deadlines.map((d, i) => (
            <div key={i} className="form-row" style={{ marginBottom: 6 }}>
              <input
                style={{ flex: 2 }}
                placeholder={`Prazo ${i + 1} — título`}
                aria-label={`Título do prazo ${i + 1}`}
                value={d.title}
                onChange={(e) =>
                  setDeadlines((all) =>
                    all.map((x, j) => (j === i ? { ...x, title: e.target.value } : x))
                  )
                }
              />
              <input
                style={{ flex: 1 }}
                type="datetime-local"
                aria-label={`Data do prazo ${i + 1}`}
                value={d.dueAt}
                onChange={(e) =>
                  setDeadlines((all) =>
                    all.map((x, j) => (j === i ? { ...x, dueAt: e.target.value } : x))
                  )
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => setDeadlines((all) => [...all, { title: "", dueAt: "" }])}
          >
            + prazo
          </button>
        </fieldset>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Salvando…" : "Salvar (gera número automático)"}
        </button>
      </form>
    </div>
  );
}
