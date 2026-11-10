"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { firebaseClient } from "@/lib/firebase-client";
import { DataTable } from "@/components/DataTable";
import { externalError, externalRequest, useExternalAccount } from "./ExternalAccount";
type RequestRow = { protocolNumber: string; publicKey: string; subject: string; status: string; createdAt: string };
export default function CitizenAccount() {
  const { user, revision, refresh } = useExternalAccount();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState("");
  const [rows, setRows] = useState<RequestRow[]>([]); const [status, setStatus] = useState(""); const [accountView, setAccountView] = useState(false);
  useEffect(() => {
    if (!user?.emailVerified) { setRows([]); return; }
    let cancelled = false; setLoading(true); setError(null);
    async function load() {
      try {
        const all: RequestRow[] = []; let page = 1;
        while (true) {
          const result = await externalRequest(`/api/cidadao/conta?page=${page}&pageSize=100`); const d = await result.json();
          if (cancelled) return;
          if (d.total === undefined && d.requests.length >= 100) throw new Error("Não foi possível confirmar a caixa completa de protocolos. Tente atualizar a consulta mais tarde.");
          all.push(...d.requests);
          if (!d.total || all.length >= d.total || !d.requests.length) break;
          page++;
        }
        setRows(all);
      } catch (e) { if (!cancelled) setError(externalError(e)); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [user, revision]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null); setNotice("");
    try {
      if (mode === "reset") { await sendPasswordResetEmail(firebaseClient(), email.trim()); setNotice("Solicitação registrada. Se houver uma conta para esse e-mail, confira as instruções de recuperação."); }
      else if (mode === "register") {
        const result = await createUserWithEmailAndPassword(firebaseClient(), email.trim(), password);
        await updateProfile(result.user, { displayName: name.trim() }); await sendEmailVerification(result.user);
        setNotice("Conta criada. Enviamos as instruções para confirmar seu e-mail."); setPassword(""); await refresh();
      } else { await signInWithEmailAndPassword(firebaseClient(), email.trim(), password); setPassword(""); }
    } catch (e) { setError(externalError(e)); } finally { setBusy(false); }
  }
  async function verify(check: boolean) {
    if (busy || !user) return; setBusy(true); setError(null); setNotice("");
    try { if (check) { await refresh(); setNotice(firebaseClient().currentUser?.emailVerified ? "E-mail confirmado." : "A confirmação ainda não foi identificada. Abra o link recebido no seu e-mail."); } else { await sendEmailVerification(user); setNotice("Instruções de confirmação enviadas. Confira sua caixa de entrada."); } }
    catch (e) { setError(externalError(e)); } finally { setBusy(false); }
  }
  if (user === undefined) return <p role="status">Carregando conta…</p>;
  if (!user) return <section className="card" style={{ maxWidth: 520 }}><h1>{mode === "register" ? "Criar conta do cidadão" : mode === "reset" ? "Recuperar acesso" : "Entrar na conta do cidadão"}</h1>{error && <p role="alert" className="alert alert-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form className="form" onSubmit={submit}>{mode === "register" && <label>Nome completo<input required minLength={3} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>}<label>E-mail<input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>{mode !== "reset" && <label>Senha<input required minLength={mode === "register" ? 12 : undefined} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>}<button className="btn btn-primary" disabled={busy}>{busy ? "Aguarde…" : mode === "register" ? "Criar conta" : mode === "reset" ? "Enviar instruções" : "Entrar"}</button></form>
    <div className="form-row">{[ ["login", "Entrar"], ["register", "Criar conta"], ["reset", "Esqueci minha senha"] ].filter(([value]) => value !== mode).map(([value, label]) => <button key={value} className="btn" disabled={busy} onClick={() => { setMode(value); setError(null); setNotice(""); }}>{label}</button>)}<Link className="btn" href="/cidadao">Portal do cidadão</Link></div></section>;
  if (!user.emailVerified || accountView) return <section className="card"><h1>Minha conta do cidadão</h1><p>{user.displayName}</p><p>{user.email}</p><p>{user.emailVerified ? "E-mail confirmado." : "Confirme seu e-mail para acessar sua caixa pessoal, anexos e complementações."}</p>{error && <p role="alert" className="alert alert-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!user.emailVerified && <><button className="btn btn-primary" disabled={busy} onClick={() => verify(true)}>Já confirmei meu e-mail</button><button className="btn" disabled={busy} onClick={() => verify(false)}>Reenviar confirmação</button></>}
    {user.emailVerified && <><button className="btn" onClick={() => setAccountView(false)}>Minha caixa de protocolos</button><Link className="btn btn-primary" href="/cidadao/conta/cadastro">Meu cadastro por perfil</Link></>}
    <button className="btn" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await sendPasswordResetEmail(firebaseClient(), user.email!); setNotice("Instruções de recuperação enviadas para seu e-mail."); } catch (e) { setError(externalError(e)); } finally { setBusy(false); } }}>Alterar senha</button>
    <button className="btn" onClick={() => signOut(firebaseClient()).catch((e) => setError(externalError(e)))}>Sair</button><Link className="btn" href="/cidadao">Portal do cidadão</Link></section>;
  return <DataTable id="citizen-inbox" title="Meus protocolos" rows={rows.filter((r) => !status || r.status === status)} rowKey={(r) => r.publicKey} loading={loading} error={error}
    actions={<><Link className="btn btn-primary" href="/cidadao?novo=1">Novo requerimento</Link><button className="btn" onClick={() => refresh().catch((e) => setError(externalError(e)))}>Atualizar</button><button className="btn" onClick={() => setAccountView(true)}>Minha conta</button><Link className="btn" href="/cidadao">Portal</Link></>}
    filters={<label>Situação<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas</option>{Array.from(new Set(rows.map((r) => r.status))).map((s) => <option key={s}>{s}</option>)}</select></label>}
    columns={[{ key: "number", label: "Protocolo", value: (r) => r.protocolNumber, render: (r) => <Link href={`/cidadao/processos/${encodeURIComponent(r.publicKey)}`}>{r.protocolNumber}</Link> }, { key: "subject", label: "Assunto", value: (r) => r.subject }, { key: "status", label: "Situação", value: (r) => r.status }, { key: "created", label: "Registrado em", value: (r) => new Date(r.createdAt).toLocaleString("pt-BR") }]} />;
}
