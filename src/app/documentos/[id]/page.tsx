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
    publicKey: string;
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
  const [busy, setBusy] = useState<"forward" | "receive" | "deadline" | null>(null);
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

  async function forward() {
    if (busy) return;
    setErr(null);
    setBusy("forward");
    try {
      await api(`/api/documents/${params.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ toDepartmentId: toDept, note }),
      });
      setNote("");
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function simulateReply() {
    if (busy) return;
    setErr(null);
    setBusy("forward");
    try {
      const data = await api("/api/email/inbound/simulate", {
        method: "POST",
        body: JSON.stringify({ documentId: params.id }),
      });
      if (data.simulated) {
        setErr(null);
      }
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function receive() {
    if (busy) return;
    setErr(null);
    setBusy("receive");
    try {
      await api(`/api/documents/${params.id}/receive`, { method: "POST" });
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
      await api(`/api/documents/${params.id}/deadlines`, {
        method: "POST",
        body: JSON.stringify({ title: nTitle, dueAt: new Date(nDue).toISOString() }),
      });
      setNTitle("");
      setNDue("");
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
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
    <div>
      <p>
        <Link href="/documentos">← memorandos</Link>
      </p>
      <h1>
        {data.document.displayNumber} — {data.document.subject}
      </h1>
      <p>
        <span className={`badge badge-${data.document.status}`}>{data.document.status}</span>{" "}
        <span className="muted">
          Origem: {data.document.origin} · Criado em{" "}
          {new Date(data.document.createdAt).toLocaleString("pt-BR")}
        </span>
      </p>
      <div className="doc-body" dangerouslySetInnerHTML={{ __html: data.document.body }} />
      <p>
        <Link href={`/publico/${data.document.publicKey}`}>Consulta pública / QR →</Link>
      </p>
      {err && (
        <p className="alert alert-error" role="alert">
          {err}
        </p>
      )}

      <h3>Prazos</h3>
      {data.deadlines.length > 0 ? (
        <ul>
          {data.deadlines.map((d) => (
            <li key={d.id}>
              {d.title} — {new Date(d.dueAt).toLocaleString("pt-BR")} ({d.status})
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nenhum prazo.</p>
      )}
      {canEdit && (
        <div className="form-row">
          <input
            style={{ flex: 2 }}
            placeholder="novo prazo — título"
            aria-label="Título do novo prazo"
            value={nTitle}
            onChange={(e) => setNTitle(e.target.value)}
          />
          <input
            style={{ flex: 1 }}
            type="datetime-local"
            aria-label="Data do novo prazo"
            value={nDue}
            onChange={(e) => setNDue(e.target.value)}
          />
          <button className="btn" onClick={addDeadline} disabled={busy !== null}>
            Adicionar
          </button>
        </div>
      )}

      <h3>Anexos</h3>
      {data.attachments.length > 0 ? (
        <ul>
          {data.attachments.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer">
                {a.filename}
              </a>{" "}
              <span className="muted">
                ({a.size ? `${new Intl.NumberFormat("pt-BR").format(Math.round(a.size / 1024))} KB` : "—"})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nenhum anexo.</p>
      )}
      {canEdit && (
        <input
          type="file"
          aria-label="Anexar arquivo"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      )}

      <h3>Tramitação</h3>
      <div className="card plain">
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
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                style={{ flex: 2 }}
                placeholder="despacho"
                aria-label="Texto do despacho"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={forward}
                disabled={!toDept || busy !== null}
              >
                {busy === "forward" ? "Despachando…" : "Despachar"}
              </button>
            </>
          )}
          <button className="btn" onClick={receive} disabled={busy !== null}>
            {busy === "receive" ? "Registrando…" : "Marcar recebido"}
          </button>
          {canEdit && (
            <button
              className="btn"
              onClick={simulateReply}
              disabled={busy !== null}
              title="Ensaio: simula a resposta do cidadão pelo mesmo código do webhook real"
            >
              Simular resposta por e-mail (ensaio)
            </button>
          )}
        </div>
      </div>

      <h3>Linha do tempo</h3>
      <ol className="timeline">
        {data.timeline.map((t) => (
          <li key={t.id}>
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
