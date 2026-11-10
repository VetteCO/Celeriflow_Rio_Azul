"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
type Cir = { id: string; displayNumber: string; subject: string; urgency: string | null; total: number; read: number; unread: number };
export default function CircularesPage() {
  const { user, permissions } = useSession();
  const [items, setItems] = useState<Cir[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [urgency, setUrgency] = useState(""); const [unread, setUnread] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const all: Cir[] = []; let page = 1;
        while (true) {
          const d = await api(`/api/circulars?page=${page}&pageSize=100`);
          if (cancelled) return;
          if (d.total === undefined && d.circulars.length >= 100) throw new Error("Não foi possível confirmar a listagem completa de circulares. Atualize a consulta após a regularização do serviço.");
          all.push(...d.circulars);
          if (!d.total || all.length >= d.total || !d.circulars.length) break;
          page++;
        }
        setItems(all);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [user, reload]);
  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user) return <p><Link href="/admin">Entre na sua conta</Link> para acessar as circulares.</p>;
  return <DataTable id="circulars" title="Circulares" rows={items.filter((c) => (!urgency || c.urgency === urgency) && (!unread || c.unread > 0))} rowKey={(c) => c.id} loading={loading} error={error}
    filters={<><label>Tipo<select value={urgency} onChange={(e) => setUrgency(e.target.value)}><option value="">Todos</option><option value="URGENT">Urgente</option><option value="INFORMATIVE">Meramente informativa</option></select></label><label><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> Com leituras pendentes</label></>}
    actions={<><button className="btn" onClick={() => setReload((v) => v + 1)}>Atualizar</button>{(permissions.includes("*") || permissions.includes("doc:create")) && <Link href="/circulares/nova" className="btn btn-primary">Nova circular</Link>}</>}
    columns={[
      { key: "number", label: "Número", value: (c) => c.displayNumber, render: (c) => <Link href={`/circulares/${c.id}`}>{c.displayNumber}</Link> },
      { key: "subject", label: "Assunto", value: (c) => c.subject },
      { key: "urgency", label: "Tipo", value: (c) => c.urgency === "URGENT" ? "Urgente" : "Meramente informativa" },
      { key: "total", label: "Destinatários", value: (c) => c.total, align: "right" },
      { key: "read", label: "Lidos", value: (c) => c.read, align: "right" },
      { key: "unread", label: "Não lidos", value: (c) => c.unread, align: "right" },
    ]} />;
}
