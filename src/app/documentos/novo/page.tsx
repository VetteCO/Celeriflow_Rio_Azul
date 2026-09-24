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

  if (user === undefined) return <p>Carregando…</p>;
  if (!user) return <p>Faça login em <Link href="/admin">/admin</Link>.</p>;
  if (role !== "ADMIN_GERAL")
    return <p>Bloqueado: somente ADMIN_GERAL cria memorando (a API retorna 403).</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const data = await api("/api/documents", {
        method: "POST",
        body: JSON.stringify({
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
    <div style={{ maxWidth: 720 }}>
      <h2>Novo memorando</h2>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <form onSubmit={save} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Assunto"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <label>
          Corpo (editor da plataforma)
          <RichText value={body} onChange={setBody} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value="">origem…</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={dest} onChange={(e) => setDest(e.target.value)}>
            <option value="">destino…</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend>Prazos (múltiplos, calendário)</legend>
          {deadlines.map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input
                placeholder={`Prazo ${i + 1} — título`}
                value={d.title}
                onChange={(e) =>
                  setDeadlines((all) => all.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                }
              />
              <input
                type="datetime-local"
                value={d.dueAt}
                onChange={(e) =>
                  setDeadlines((all) => all.map((x, j) => (j === i ? { ...x, dueAt: e.target.value } : x)))
                }
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDeadlines((all) => [...all, { title: "", dueAt: "" }])}
          >
            + prazo
          </button>
        </fieldset>
        <button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar (gera número automático)"}
        </button>
      </form>
    </div>
  );
}
