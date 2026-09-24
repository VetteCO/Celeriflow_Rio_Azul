"use client";
// POC-06 — nova circular: tipo + múltiplos setores + rich text.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { RichText } from "@/components/RichText";

type Dept = { id: string; name: string; acronym: string | null };

export default function NovaCircular() {
  const { user, role } = useSession();
  const router = useRouter();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState("URGENT");
  const [origin, setOrigin] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api("/api/circulars")
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
        Bloqueado: somente ADMIN_GERAL cria circular (a API retorna 403).
      </p>
    );

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setErr(null);
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
        }),
      });
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
              {depts.map((d) => (
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
          {depts.map((d) => (
            <label key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
              <input
                type="checkbox"
                style={{ width: "auto", minHeight: "auto" }}
                checked={picked.includes(d.id)}
                onChange={() => toggle(d.id)}
              />
              {d.name} ({d.acronym})
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
