"use client";
// POC-06 — detalhe: painel lido/não lido por servidor + filtro + recibo próprio.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
import { DepartmentPicker, type PickDepartment } from "@/components/DepartmentPicker";

type Detail = {
  circular: {
    id: string;
    displayNumber: string;
    subject: string;
    body: string;
    urgency: string | null;
    status: string;
    circularReplyMode: string;
    createdAt: string;
  };
  myReceipt: { firstReadAt: string } | null;
  stats: { total: number; read: number; unread: number };
  canEditRecipients: boolean;
  departmentIds: string[];
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
  const [editing, setEditing] = useState(false);
  const [departments, setDepartments] = useState<PickDepartment[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [includeChildren, setIncludeChildren] = useState(false);
  const [saving, setSaving] = useState(false);

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
  async function editRecipients() {
    try { const response = await api("/api/admin/departments"); setDepartments(response.departments); setPicked(data!.departmentIds); setEditing(true); setErr(null); }
    catch (error) { setErr((error as Error).message); }
  }
  async function saveRecipients() {
    if (saving) return; setSaving(true); setErr(null);
    try { await api(`/api/circulars/${params.id}/recipients`, { method: "PATCH", body: JSON.stringify({ departmentIds: picked, includeSubdepartments: includeChildren }) }); setEditing(false); load(); }
    catch (error) { setErr((error as Error).message); } finally { setSaving(false); }
  }
  if (editing) return <section><h1>Destinatários da circular</h1>{err && <p role="alert">{err}</p>}<p>Destinatários removidos perdem o acesso. Recibos anteriores permanecem no histórico e serão preservados se o servidor voltar a receber a circular.</p><DepartmentPicker departments={departments} value={picked} onChange={setPicked} disabled={saving} /><label><input type="checkbox" checked={includeChildren} onChange={e => setIncludeChildren(e.target.checked)} /> Incluir subsetores</label><div className="form-row"><button className="btn btn-primary" disabled={saving || !picked.length} onClick={saveRecipients}>Salvar destinatários</button><button className="btn" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button></div></section>;

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
          {data.circular.urgency === "URGENT" ? "Urgente" : "Meramente Informativa"}
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
      <p>{data.circular.urgency === "INFORMATIVE" ? "Sem respostas ou encaminhamento pelos destinatários." : data.circular.circularReplyMode === "RESTRICTED" ? "Respostas restritas ao setor remetente e ao próprio autor da resposta." : "Respostas abertas a todos os envolvidos."}</p>
      <p>
        <strong>{data.stats.read}</strong> lidos · <strong>{data.stats.unread}</strong> não
        lidos · {data.stats.total} destinatários
      </p>
        <button className="btn" onClick={() => setShowRecipients(true)}>Consultar destinatários e recibos</button>
        {data.canEditRecipients && <button className="btn" onClick={editRecipients}>Alterar destinatários</button>}
       <Link className="btn" href={`/documentos/${params.id}`}>Anexos, prazos e tramitação</Link>
    </div>
  );
}
