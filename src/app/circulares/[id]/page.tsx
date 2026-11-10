"use client";
// POC-06 — detalhe: painel lido/não lido por servidor + filtro + recibo próprio.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";

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

export default function CircularDetail() {
  const params = useParams<{ id: string }>();
  const { user } = useSession();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);

  const load = useCallback(
     () => {
       api(`/api/circulars/${params.id}`)
        .then(setData)
        .catch((e) => setErr((e as Error).message));
    },
    [params.id]
  );

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
  if (!data) return <p role="status">Carregando circular…</p>;

  if (showRecipients) return <DataTable id="circular-recipients" title={`Destinatários — ${data.circular.displayNumber}`} rows={data.recipients.filter((r) => !onlyUnread || !r.read)} rowKey={(r) => r.userId} error={err}
    actions={<><Link className="btn" href="/circulares">Circulares</Link><button className="btn" onClick={() => setShowRecipients(false)}>Voltar à circular</button><button className="btn" onClick={load}>Atualizar</button></>} filters={<label><input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /> Somente não lidos</label>} columns={[
      { key: "name", label: "Nome", value: (r) => r.name }, { key: "email", label: "E-mail", value: (r) => r.email }, { key: "sector", label: "Setor", value: (r) => r.sector }, { key: "read", label: "Situação", value: (r) => r.read ? "Lido" : "Não lido" }, { key: "date", label: "Primeira leitura", value: (r) => r.firstReadAt ? new Date(r.firstReadAt).toLocaleString("pt-BR") : "—" },
    ]} />;

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
       <button className="btn" onClick={() => setShowRecipients(true)}>Consultar destinatários e recibos</button>
       <Link className="btn" href={`/documentos/${params.id}`}>Anexos, prazos e tramitação</Link>
    </div>
  );
}
