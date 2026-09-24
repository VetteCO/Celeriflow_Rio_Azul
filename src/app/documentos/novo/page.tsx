"use client";
// POC-04 — novo memorando: assunto + rich text + origem/destino + prazos múltiplos.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { RichText } from "@/components/RichText";

type Dept = { id: string; name: string; acronym: string | null };

export default function NovoMemorando() {
  const { user, role } = useSession();
  const router = useRouter();
  const [depts, setDepts] = useState<Dept[]>([]);
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

  useEffect(() => {
    if (!user) return;
    api("/api/documents")
      .then((d) => setDepts(d.departments))
      .catch((e) => setErr((e as Error).message));
  }, [user]);

  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user)
    return (
      <p>
        Faça login em <Link href="/admin">/admin</Link>.
      </p>
    );
  if (role !== "ADMIN_GERAL")
    return (
      <p className="alert alert-warn">
        Bloqueado: somente ADMIN_GERAL cria memorando (a API retorna 403).
      </p>
    );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const data = await api("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          type: docType,
          subject,
          body,
          originDepartmentId: origin || null,
          toDepartmentId: dest || null,
          deadlines: deadlines
            .filter((d) => d.title && d.dueAt)
            .map((d) => ({ title: d.title, dueAt: new Date(d.dueAt).toISOString() })),
        }),
      });
      router.push(`/documentos/${data.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Novo memorando</h1>
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
          Assunto
          <input
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
              {depts.map((d) => (
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
