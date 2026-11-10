"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
type Dept = { id: string; name: string; acronym: string | null; parentId: string | null; active: boolean };
const empty = { name: "", acronym: "", parentId: "", active: true, reassignToDepartmentId: "" };
export default function SetoresPage() {
  const { user, role } = useSession();
  const [rows, setRows] = useState<Dept[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = role === "ADMIN_GERAL";
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await api("/api/admin/departments"); setRows(d.departments); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);
  function path(d: Dept): string {
    const parts = [d.name]; const seen = new Set([d.id]); let parent = rows.find((r) => r.id === d.parentId);
    while (parent && !seen.has(parent.id)) { seen.add(parent.id); parts.unshift(parent.name); parent = rows.find((r) => r.id === parent?.parentId); }
    return parts.join(" / ");
  }
  function descendant(id: string): boolean {
    const seen = new Set<string>(); let current = rows.find((d) => d.id === id);
    while (current && !seen.has(current.id)) { if (current.id === editing) return true; seen.add(current.id); current = rows.find((d) => d.id === current?.parentId); }
    return false;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null);
    try { await api(editing ? `/api/admin/departments/${editing}` : "/api/admin/departments", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ ...form, parentId: form.parentId || null, reallocateToDepartmentId: form.reassignToDepartmentId || undefined }) }); setShow(false); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user) return <p><Link href="/admin">Entre na sua conta</Link> para consultar os setores.</p>;
  if (show) return <section className="card"><h1>{editing ? "Editar setor" : "Novo setor"}</h1>{error && <p role="alert" className="alert alert-error">{error}</p>}<form className="form" onSubmit={save}>
    <label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
    <label>Sigla<input required value={form.acronym} onChange={(e) => setForm({ ...form, acronym: e.target.value.toUpperCase() })} /></label>
    <label>Setor superior<select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}><option value="">Sem setor superior</option>{rows.filter((d) => d.active && !descendant(d.id)).map((d) => <option key={d.id} value={d.id}>{path(d)}</option>)}</select></label>
    {editing && <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Setor ativo</label>}
    {!form.active && <label>Realocar vínculos e pendências para<select required value={form.reassignToDepartmentId} onChange={(e) => setForm({ ...form, reassignToDepartmentId: e.target.value })}><option value="">Selecione o setor</option>{rows.filter((d) => d.active && !descendant(d.id)).map((d) => <option key={d.id} value={d.id}>{path(d)}</option>)}</select></label>}
    <div className="form-row"><button className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button><button type="button" className="btn" disabled={busy} onClick={() => setShow(false)}>Cancelar</button></div>
  </form></section>;
  return <DataTable id="departments" title="Setores e organograma" rows={rows} rowKey={(d) => d.id} loading={loading} error={error} actions={<><button className="btn" onClick={load}>Atualizar</button>{canEdit && <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(empty); setShow(true); }}>Novo setor</button>}</>}
    columns={[{ key: "name", label: "Setor", value: (d) => d.name }, { key: "acronym", label: "Sigla", value: (d) => d.acronym ?? "—" }, { key: "tree", label: "Hierarquia", value: path }, { key: "status", label: "Situação", value: (d) => d.active ? "Ativo" : "Inativo" }, { key: "actions", label: "Ações", value: () => canEdit ? "Editar" : "—", render: (d) => canEdit ? <button className="btn" onClick={() => { setEditing(d.id); setForm({ ...empty, ...d, acronym: d.acronym ?? "", parentId: d.parentId ?? "" }); setShow(true); }}>Editar</button> : "—" }]} />;
}
