"use client";
// POC-05 — detalhe + timeline cronológica + tramitar + receber + prazos + anexos.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, getToken, useSession } from "@/components/session";

type Detail = {
  document: {
    id: string;
    displayNumber: string;
    subject: string;
    body: string;
    status: string;
    origin: string;
    createdAt: string;
  };
  deadlines: Array<{ id: string; title: string; dueAt: string; status: string }>;
  timeline: Array<{
    id: string;
    action: string;
    from: string;
    to: string;
    note: string | null;
    actor: string;
    at: string;
  }>;
  attachments: Array<{ id: string; filename: string; url: string; size: number | null }>;
  departments: Array<{ id: string; name: string; acronym: string | null }>;
};

export default function DocDetail({ params }: { params: { id: string } }) {
  const { user, role } = useSession();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toDept, setToDept] = useState("");
  const [note, setNote] = useState("");
  const [nTitle, setNTitle] = useState("");
  const [nDue, setNDue] = useState("");
  const canEdit = role === "ADMIN_GERAL";

  const load = useCallback(() => {
    api(`/api/documents/${params.id}`)
      .then(setData)
      .catch((e) => setErr((e as Error).message));
  }, [params.id]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  if (user === undefined) return <p>Carregando…</p>;
  if (!user) return <p>Faça login em <Link href="/admin">/admin</Link>.</p>;
  if (err) return <p style={{ color: "crimson" }}>{err}</p>;
  if (!data) return <p>Carregando documento…</p>;

  async function forward() {
    setErr(null);
    try {
      await api(`/api/documents/${params.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ toDepartmentId: toDept, note }),
      });
      setNote("");
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function receive() {
    setErr(null);
    try {
      await api(`/api/documents/${params.id}/receive`, { method: "POST" });
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function addDeadline() {
    setErr(null);
    try {
      await api(`/api/documents/${params.id}/deadlines`, {
        method: "POST",
        body: JSON.stringify({ title: nTitle, dueAt: new Date(nDue).toISOString() }),
      });
      setNTitle("");
      setNDue("");
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function upload(file: File) {
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
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <p>
        <Link href="/documentos">← memorandos</Link>
      </p>
      <h2>
        {data.document.displayNumber} — {data.document.subject}
      </h2>
      <p>
        Status: <strong>{data.document.status}</strong> · Origem: {data.document.origin} ·
        Criado em {new Date(data.document.createdAt).toLocaleString("pt-BR")}
      </p>
      <article
        style={{ border: "1px solid #ddd", padding: 12, background: "#fff" }}
        dangerouslySetInnerHTML={{ __html: data.document.body }}
      />
      {err && <p style={{ color: "crimson" }}>{err}</p>}

      <h3>Prazos</h3>
      <ul>
        {data.deadlines.map((d) => (
          <li key={d.id}>
            {d.title} — {new Date(d.dueAt).toLocaleString("pt-BR")} ({d.status})
          </li>
        ))}
        {data.deadlines.length === 0 && <li>Nenhum prazo.</li>}
      </ul>
      {canEdit && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="novo prazo — título" value={nTitle} onChange={(e) => setNTitle(e.target.value)} />
          <input type="datetime-local" value={nDue} onChange={(e) => setNDue(e.target.value)} />
          <button onClick={addDeadline}>Adicionar</button>
        </div>
      )}

      <h3>Anexos</h3>
      <ul>
        {data.attachments.map((a) => (
          <li key={a.id}>
            <a href={a.url} target="_blank" rel="noreferrer">
              {a.filename}
            </a>{" "}
            ({a.size ? `${Math.round(a.size / 1024)} KB` : "—"})
          </li>
        ))}
        {data.attachments.length === 0 && <li>Nenhum anexo.</li>}
      </ul>
      {canEdit && (
        <input
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      )}

      <h3>Tramitação</h3>
      {canEdit ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={toDept} onChange={(e) => setToDept(e.target.value)}>
            <option value="">destino…</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input placeholder="despacho" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={forward} disabled={!toDept}>
            Despachar
          </button>
          <button onClick={receive}>Marcar recebido</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={receive}>Marcar recebido</button>
        </div>
      )}

      <h3>Linha do tempo</h3>
      <ol>
        {data.timeline.map((t) => (
          <li key={t.id} style={{ marginBottom: 6 }}>
            <strong>{t.action}</strong> — {t.from} → {t.to} · por {t.actor} ·{" "}
            {new Date(t.at).toLocaleString("pt-BR")}
            {t.note && (
              <>
                <br />
                <em>{t.note}</em>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
