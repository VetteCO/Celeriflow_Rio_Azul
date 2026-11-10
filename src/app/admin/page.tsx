"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseClient } from "@/lib/firebase-client";
import { api, useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
import { MaskedInput } from "@/components/MaskedInput";

type Server = { id: string; name: string; email: string; cpf?: string; active: boolean; departmentId: string | null; secondaryDepartmentIds?: string[]; roles: string[]; phone?: string; registration?: string; position?: string; jobTitle?: string; lastAccessAt?: string; leaveStart?: string | null; leaveEnd?: string | null; preferences?: Record<string, boolean> };
type Dept = { id: string; name: string; active?: boolean };
type MyAccount = { userId: string; name: string; email: string; roles: string[]; permissions: string[]; departmentId: string | null; departmentIds: string[]; profile?: { phone?: string; registration?: string; position?: string; preferences?: Record<string, boolean>; leaveStart?: string; leaveEnd?: string; lastAccessAt?: string } | null };
const profiles: Record<string, string> = { ADMIN_GERAL: "Administrador geral", ADMIN_LOCAL: "Administrador local", NIVEL_1: "Nível 1", NIVEL_2: "Nível 2", NIVEL_3_VISUALIZACAO: "Nível 3 — visualização", AUDITOR: "Auditor" };
const blank = { name: "", email: "", cpf: "", phone: "", registration: "", jobTitle: "", departmentId: "", secondaryDepartmentIds: [] as string[], role: "NIVEL_3_VISUALIZACAO", password: "", active: true, leaveStart: "", leaveEnd: "", preferences: { email: true } as Record<string, boolean> };
export default function AdminPage() {
  const { user, permissions } = useSession();
  const [users, setUsers] = useState<Server[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [profileDirty, setProfileDirty] = useState(false);
  const [me, setMe] = useState<MyAccount | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [accountDepartments, setAccountDepartments] = useState<Dept[]>([]);
  const [personalPhone, setPersonalPhone] = useState("");
  const [personalPreferences, setPersonalPreferences] = useState<Record<string, boolean>>({});
  const canManage = permissions.includes("*") || permissions.includes("admin:users");
  const loadMe = useCallback(async () => {
    setMeError(null);
    try { const [account, sectors] = await Promise.all([api("/api/admin/me"), api("/api/admin/departments")]); setMe(account); setAccountDepartments(sectors.departments); setPersonalPhone(account.phone ?? account.profile?.phone ?? ""); setPersonalPreferences(account.preferences ?? account.profile?.preferences ?? {}); }
    catch (e) { setMeError((e as Error).message); }
  }, []);
  useEffect(() => { if (user) void loadMe(); else { setMe(null); setUsers([]); } }, [user, loadMe]);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await api("/api/admin/users"); setUsers(d.users); setDepts(d.departments); setAllowedRoles(d.roles); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user && canManage) void load(); }, [user, canManage, load]);
  async function login(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null);
    try { await signInWithEmailAndPassword(firebaseClient(), email, password); setPassword(""); }
    catch { setError("Não foi possível entrar. Confira seu e-mail e sua senha."); }
    finally { setBusy(false); }
  }
  async function recover(target: string) {
    if (busy) return; if (!target) { setError("Informe o e-mail para recuperar o acesso."); return; }
    setBusy(true); setError(null);
    try { await sendPasswordResetEmail(firebaseClient(), target); setNotice("Solicitação registrada. Confira as instruções de recuperação no e-mail informado."); }
    catch { setError("Não foi possível solicitar a recuperação agora."); }
    finally { setBusy(false); }
  }
  async function savePersonal(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null); setNotice("");
    try { const account = await api("/api/admin/me", { method: "PATCH", body: JSON.stringify({ phone: personalPhone, preferences: personalPreferences }) }); setMe(account); setNotice("Telefone e preferências atualizados."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null); setNotice("");
    try {
      const profile = { registration: form.registration, position: form.jobTitle, secondaryDepartmentIds: form.secondaryDepartmentIds, leaveStart: form.leaveStart ? new Date(`${form.leaveStart}T00:00:00`).toISOString() : null, leaveEnd: form.leaveEnd ? new Date(`${form.leaveEnd}T23:59:59`).toISOString() : null, preferences: form.preferences };
      if (form.leaveStart && form.leaveEnd && form.leaveEnd < form.leaveStart) throw new Error("O término do afastamento deve ser posterior ao início.");
      const result = await api(editing ? `/api/admin/users/${editing}` : "/api/admin/users", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ name: form.name, email: form.email, cpf: form.cpf, phone: form.phone, active: form.active, role: form.role, departmentId: form.departmentId || null, password: form.password || undefined, ...(!editing || profileDirty ? profile : {}) }) });
      const id = editing ?? result.id;
      if (editing && !users.find((u) => u.id === editing)?.roles.includes(form.role)) {
        await api(`/api/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role: form.role }) });
      }
      setNotice(editing ? "Cadastro atualizado." : "Servidor cadastrado com acesso institucional.");
      setShowForm(false); setEditing(null); setForm(blank); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function edit(u: Server) {
    setEditing(u.id); setProfileDirty(false); setForm({ ...blank, ...u, cpf: u.cpf ?? "", phone: u.phone ?? "", registration: u.registration ?? "", jobTitle: u.position ?? u.jobTitle ?? "", departmentId: u.departmentId ?? "", secondaryDepartmentIds: u.secondaryDepartmentIds ?? [], role: u.roles[0] ?? blank.role, password: "", leaveStart: u.leaveStart?.slice(0, 10) ?? "", leaveEnd: u.leaveEnd?.slice(0, 10) ?? "", preferences: u.preferences ?? { email: true } }); setShowForm(true);
  }
  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user) return <section className="card" style={{ maxWidth: 460 }}><h1>Acesso institucional</h1>
    {error && <p role="alert" className="alert alert-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form className="form" onSubmit={login}><label>E-mail<input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Senha<input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="btn btn-primary" disabled={busy}>{busy ? "Aguarde…" : "Entrar"}</button></form>
    <button className="btn" disabled={busy} onClick={() => recover(email)}>Recuperar acesso</button><Link className="btn" href="/login-govbr">Acesso Gov.br</Link></section>;
  if (!canManage || showAccount) return <section className="card">
    <h1>Minha conta</h1>{meError && <p className="alert alert-error" role="alert">{meError}</p>}{!me && !meError && <p role="status">Carregando ficha pessoal…</p>}
    {me && <><h2>{me.name}</h2><p>{me.email}</p><dl>
      <dt>Perfis</dt><dd>{me.roles.map((r) => profiles[r] ?? r).join(", ")}</dd>
      <dt>Setor principal</dt><dd>{accountDepartments.find((d) => d.id === me.departmentId)?.name ?? "—"}</dd>
      <dt>Vínculos setoriais</dt><dd>{me.departmentIds.map((id) => accountDepartments.find((d) => d.id === id)?.name ?? id).join(", ") || "—"}</dd>
      <dt>Matrícula</dt><dd>{me.profile?.registration || "—"}</dd><dt>Cargo</dt><dd>{me.profile?.position || "—"}</dd>
      <dt>Afastamento</dt><dd>{me.profile?.leaveStart ? new Date(me.profile.leaveStart).toLocaleDateString("pt-BR") : "—"} até {me.profile?.leaveEnd ? new Date(me.profile.leaveEnd).toLocaleDateString("pt-BR") : "—"}</dd>
      <dt>Último acesso</dt><dd>{me.profile?.lastAccessAt ? new Date(me.profile.lastAccessAt).toLocaleString("pt-BR") : "—"}</dd>
    </dl><form className="form" onSubmit={savePersonal}><h2>Contato e preferências</h2><label>Telefone<MaskedInput kind="phone" value={personalPhone} onValueChange={setPersonalPhone} /></label><label><input type="checkbox" checked={personalPreferences.email ?? true} onChange={(e) => setPersonalPreferences({ ...personalPreferences, email: e.target.checked })} /> Receber notificações por e-mail quando o canal estiver disponível</label><button className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar preferências"}</button></form></>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="alert alert-error">{error}</p>}<div className="form-row">{canManage && <button className="btn" onClick={() => setShowAccount(false)}>Servidores</button>}<button className="btn" onClick={loadMe}>Atualizar ficha</button><button className="btn" disabled={busy} onClick={() => recover(user.email ?? "")}>Recuperar acesso</button><Link className="btn" href="/documentos">Documentos</Link><button className="btn" onClick={() => signOut(firebaseClient())}>Sair</button></div>
  </section>;
  return <div>
    {showForm ? <section className="card"><h1>{editing ? "Editar servidor" : "Novo servidor"}</h1>{error && <p role="alert" className="alert alert-error">{error}</p>}
      <form className="form" onSubmit={save}>
        <div className="form-row"><label>Nome completo<input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>E-mail institucional<input required readOnly={!!editing} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div>
        <div className="form-row"><label>CPF<MaskedInput kind="cpf" value={form.cpf} onValueChange={(cpf) => setForm({ ...form, cpf })} /></label><label>Telefone<MaskedInput kind="phone" value={form.phone} onValueChange={(phone) => setForm({ ...form, phone })} /></label></div>
        <div className="form-row"><label>Matrícula<input value={form.registration} onChange={(e) => { setProfileDirty(true); setForm({ ...form, registration: e.target.value }); }} /></label><label>Cargo<input value={form.jobTitle} onChange={(e) => { setProfileDirty(true); setForm({ ...form, jobTitle: e.target.value }); }} /></label></div>
        <fieldset onChange={() => setProfileDirty(true)}><legend>Afastamento e preferências</legend><div className="form-row"><label>Início do afastamento<input type="date" value={form.leaveStart} onChange={(e) => setForm({ ...form, leaveStart: e.target.value })} /></label><label>Término do afastamento<input type="date" min={form.leaveStart || undefined} value={form.leaveEnd} onChange={(e) => setForm({ ...form, leaveEnd: e.target.value })} /></label></div><label><input type="checkbox" checked={form.preferences.email ?? true} onChange={(e) => setForm({ ...form, preferences: { ...form.preferences, email: e.target.checked } })} /> Receber notificações por e-mail quando o canal estiver disponível</label></fieldset>
        <div className="form-row"><label>Setor principal<select required value={form.departmentId} onChange={(e) => { setProfileDirty(true); setForm({ ...form, departmentId: e.target.value, secondaryDepartmentIds: form.secondaryDepartmentIds.filter((id) => id !== e.target.value) }); }}><option value="">Selecione</option>{depts.filter((d) => d.active !== false).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Perfil<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{allowedRoles.map((key) => <option key={key} value={key}>{profiles[key] ?? key}</option>)}</select></label></div>
        <fieldset onChange={() => setProfileDirty(true)}><legend>Vínculos secundários</legend>{depts.filter((d) => d.active !== false && d.id !== form.departmentId).map((d) => <label key={d.id}><input type="checkbox" checked={form.secondaryDepartmentIds.includes(d.id)} onChange={(e) => setForm({ ...form, secondaryDepartmentIds: e.target.checked ? [...form.secondaryDepartmentIds, d.id] : form.secondaryDepartmentIds.filter((id) => id !== d.id) })} /> {d.name}</label>)}</fieldset>
        {!editing && <label>Senha inicial (mínimo de 12 caracteres)<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>}
        {editing && <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Acesso ativo</label>}
        <div className="form-row"><button className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button><button type="button" className="btn" disabled={busy} onClick={() => setShowForm(false)}>Cancelar</button>{editing && <button type="button" className="btn" disabled={busy} onClick={() => recover(form.email)}>Recuperar acesso</button>}</div>
      </form></section> : <DataTable id="servers" title="Servidores e permissões" rows={users.filter((u) => !statusFilter || (statusFilter === "active" ? u.active : !u.active))} rowKey={(u) => u.id} loading={loading} error={error}
      actions={<><button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ ...blank, role: allowedRoles.includes(blank.role) ? blank.role : allowedRoles[0] ?? blank.role }); setShowForm(true); }}>Novo servidor</button><Link className="btn" href="/setores">Setores</Link><button className="btn" onClick={load}>Atualizar</button><button className="btn" onClick={() => { setShowAccount(true); void loadMe(); }}>Minha conta</button></>}
      filters={<><label>Situação<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">Todas</option><option value="active">Ativos</option><option value="inactive">Suspensos</option></select></label>{notice && <span role="status">{notice}</span>}</>}
      columns={[
        { key: "name", label: "Nome", value: (u) => u.name }, { key: "email", label: "E-mail", value: (u) => u.email },
        { key: "department", label: "Setor", value: (u) => depts.find((d) => d.id === u.departmentId)?.name ?? "—" },
        { key: "role", label: "Perfil", value: (u) => u.roles.map((r) => profiles[r] ?? r).join(", ") },
        { key: "active", label: "Situação", value: (u) => u.active ? "Ativo" : "Suspenso" },
        { key: "lastAccess", label: "Último acesso", value: (u) => u.lastAccessAt ? new Date(u.lastAccessAt).toLocaleString("pt-BR") : "—" },
        { key: "actions", label: "Ações", value: () => "Editar", render: (u) => <button className="btn" onClick={() => edit(u)}>Editar</button> },
      ]} />}</div>;
}
