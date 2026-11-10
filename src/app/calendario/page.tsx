"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
type Deadline = { id: string; documentId: string; displayNumber: string; title: string; dueAt: string; status: string };
export default function CalendarioPage() {
  const { user } = useSession();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [rows, setRows] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState("month");
  const [selected, setSelected] = useState<number | null>(null);
  const [holidays, setHolidays] = useState<Array<{ id: string; date: string; title: string }>>([]);
  useEffect(() => {
    if (!user) return; let cancelled = false; setLoading(true); setError(null);
    // Adjacent UTC months cover local-time deadlines at the month boundaries.
    const months = [-1, 0, 1].map((delta) => { const d = new Date(month.getFullYear(), month.getMonth() + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
    Promise.all(months.map((m) => api(`/api/deadlines?month=${m}`))).then((results) => {
      if (cancelled) return;
      const all = results.flatMap((d) => d.deadlines) as Deadline[];
      setRows(all.filter((d) => { const due = new Date(d.dueAt); return due.getFullYear() === month.getFullYear() && due.getMonth() === month.getMonth(); }));
      setHolidays(results[1].holidays ?? []);
    }).catch((e) => { if (!cancelled) setError((e as Error).message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, month]);
  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user) return <p><Link href="/admin">Entre na sua conta</Link> para consultar o calendário.</p>;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = month.getDay();
  const move = (delta: number) => { setSelected(null); setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1)); };
  const toolbar = <><button className="btn" aria-label="Mês anterior" onClick={() => move(-1)}>Anterior</button><strong>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><button className="btn" aria-label="Próximo mês" onClick={() => move(1)}>Próximo</button><button className="btn" onClick={() => { setSelected(null); setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }}>Hoje</button><button className="btn" onClick={() => setView(view === "month" ? "list" : "month")}>{view === "month" ? "Ver agenda" : "Ver mês"}</button></>;
  if (view === "list") return <DataTable id="calendar-deadlines" title="Agenda de prazos" rows={rows} rowKey={(d) => d.id} loading={loading} error={error} actions={toolbar} columns={[{ key: "doc", label: "Documento", value: (d) => d.displayNumber, render: (d) => <Link href={`/documentos/${d.documentId}`}>{d.displayNumber}</Link> }, { key: "title", label: "Atividade", value: (d) => d.title }, { key: "due", label: "Vencimento", value: (d) => new Date(d.dueAt).toLocaleString("pt-BR") }, { key: "status", label: "Situação", value: (d) => d.status }]} />;
  return <section><h1>Calendário de prazos</h1><div className="form-row">{toolbar}</div>{error && <p role="alert" className="alert alert-error">{error}</p>}{loading && <p role="status">Carregando prazos…</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginTop: 16 }}>
      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <strong key={day} style={{ textAlign: "center" }}>{day}</strong>)}
      {Array.from({ length: offset }, (_, i) => <div key={`empty-${i}`} />)}
      {Array.from({ length: days }, (_, i) => { const day = i + 1; const deadlines = rows.filter((d) => new Date(d.dueAt).getDate() === day); return <button className="btn" key={day} aria-pressed={selected === day} aria-label={`${day}, ${deadlines.length} prazos`} onClick={() => setSelected(day)} style={{ minHeight: 72, display: "flex", flexDirection: "column", alignItems: "start", background: selected === day ? "var(--surface-active, #e8f1fa)" : undefined }}><strong>{day}</strong>{deadlines.length > 0 && <span>{deadlines.length} prazo(s)</span>}</button>; })}
    </div>
    {holidays.length > 0 && <p className="muted">Feriados: {holidays.map((h) => `${h.date.slice(8, 10)} — ${h.title}`).join("; ")}</p>}
    {selected !== null && <section className="card"><h2>Prazos de {selected}/{month.getMonth() + 1}</h2>{rows.filter((d) => new Date(d.dueAt).getDate() === selected).length === 0 ? <p>Nenhum prazo neste dia.</p> : <ul>{rows.filter((d) => new Date(d.dueAt).getDate() === selected).map((d) => <li key={d.id}><Link href={`/documentos/${d.documentId}`}>{d.displayNumber} — {d.title}</Link> · {new Date(d.dueAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {d.status}</li>)}</ul>}</section>}
  </section>;
}
