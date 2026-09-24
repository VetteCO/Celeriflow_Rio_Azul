"use client";
// POC-06 — detalhe: painel lido/não lido por servidor + filtro + recibo próprio.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "@/components/session";

type Detail = {
  circular: {
    id: string;
    displayNumber: string;
    subject: string;
    body: string;
    urgency: string | null;
    status: string;
    createdAt: string;
  };
  myReceipt: { firstReadAt: string } | null;
  stats: { total: number; read: number; unread: number };
  recipients: Array<{
    userId: string;
    name: string;
    email: string;
    sector: string;
    read: boolean;
    firstReadAt: string | null;
  }>;
};

export default function CircularDetail({ params }: { params: { id: string } }) {
  const { user } = useSession();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const load = useCallback(
    (unread: boolean) => {
      api(`/api/circulars/${params.id}${unread ? "?unread=1" : ""}`)
        .then(setData)
        .catch((e) => setErr((e as Error).message));
    },
    [params.id]
  );

  useEffect(() => {
    if (!user) return;
    load(onlyUnread);
  }, [user, onlyUnread, load]);

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
  if (!data) return <p role="status">Carregando circular…</p>;

  return (
    <div>
      <p>
        <Link href="/circulares">← circulares</Link>
      </p>
      <h1>
        {data.circular.displayNumber} — {data.circular.subject}
      </h1>
      <p>
        <span
          className={`badge ${data.circular.urgency === "URGENT" ? "badge-IN_TRANSIT" : "badge-DRAFT"}`}
        >
          {data.circular.urgency === "URGENT" ? "Urgente" : "Informativa"}
        </span>{" "}
        <span className="muted">
          Criada em {new Date(data.circular.createdAt).toLocaleString("pt-BR")}
        </span>
      </p>
      <div className="doc-body" dangerouslySetInnerHTML={{ __html: data.circular.body }} />
      {data.myReceipt && (
        <p className="alert alert-ok">
          Você leu em {new Date(data.myReceipt.firstReadAt).toLocaleString("pt-BR")} (primeira
          leitura registrada, imutável).
        </p>
      )}

      <h2>Acompanhamento de leitura</h2>
      <p>
        <strong>{data.stats.read}</strong> lidos · <strong>{data.stats.unread}</strong> não
        lidos · {data.stats.total} destinatários
      </p>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
        <input
          type="checkbox"
          style={{ width: "auto", minHeight: "auto" }}
          checked={onlyUnread}
          onChange={(e) => setOnlyUnread(e.target.checked)}
        />
        Mostrar só não lidos
      </label>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Servidor</th>
              <th scope="col">Setor</th>
              <th scope="col">Status</th>
              <th scope="col">Lido em</th>
            </tr>
          </thead>
          <tbody>
            {data.recipients.map((r) => (
              <tr key={r.userId}>
                <td>
                  {r.name}
                  <div className="muted">{r.email}</div>
                </td>
                <td>{r.sector}</td>
                <td>
                  <span className={`badge ${r.read ? "badge-OPEN" : "badge-DRAFT"}`}>
                    {r.read ? "Lido" : "Não lido"}
                  </span>
                </td>
                <td>
                  {r.firstReadAt
                    ? new Date(r.firstReadAt).toLocaleString("pt-BR")
                    : "—"}
                </td>
              </tr>
            ))}
            {data.recipients.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  {onlyUnread ? "Todos leram. Nada pendente." : "Sem destinatários."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
