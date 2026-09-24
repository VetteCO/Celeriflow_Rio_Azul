"use client";
// POC-01 — /admin: login Firebase (email/senha + Google), lista usuários,
// cria usuário interno e troca role (sincroniza custom claim via API).
import { useCallback, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseClient } from "@/lib/firebase-client";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  firebaseUid: string | null;
  departmentId: string | null;
  roles: string[];
};
type Dept = { id: string; name: string; acronym: string | null };

async function api(path: string, token: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `http_${res.status}`);
  return data;
}

export default function AdminPage() {
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nDept, setNDept] = useState("");
  const [nRole, setNRole] = useState("NIVEL_3_VISUALIZACAO");

  useEffect(() => {
    const auth = firebaseClient();
    return onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (!u) {
        setUsers([]);
        setRole(null);
        return;
      }
      try {
        const token = await u.getIdTokenResult();
        setRole((token.claims.role as string) ?? null);
        const t = await u.getIdToken();
        const data = await api("/api/admin/users", t);
        setUsers(data.users);
        setDepts(data.departments);
        setErr(null);
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }, []);

  const refresh = useCallback(async () => {
    const auth = firebaseClient();
    const u = auth.currentUser;
    if (!u) return;
    const t = await u.getIdToken(true);
    const token = await u.getIdTokenResult(true);
    setRole((token.claims.role as string) ?? null);
    const data = await api("/api/admin/users", t);
    setUsers(data.users);
    setDepts(data.departments);
  }, []);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loggingIn) return;
    setErr(null);
    setLoggingIn(true);
    try {
      await signInWithEmailAndPassword(firebaseClient(), email, pass);
    } catch {
      setErr("Login falhou: confira e-mail/senha.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function doGoogle() {
    setErr(null);
    try {
      await signInWithPopup(firebaseClient(), new GoogleAuthProvider());
    } catch {
      setErr("Google falhou: ative o provider Google no Firebase Console > Authentication.");
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setErr(null);
    setCreating(true);
    try {
      const t = await fbUser!.getIdToken();
      await api("/api/admin/users", t, {
        method: "POST",
        body: JSON.stringify({
          name: nName,
          email: nEmail,
          departmentId: nDept || null,
          role: nRole,
        }),
      });
      setNName("");
      setNEmail("");
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function changeRole(id: string, next: string, firebaseUid: string | null) {
    setErr(null);
    const target = next === "ADMIN_GERAL" ? "Admin Geral" : "Nível 3";
    if (!window.confirm(`Confirmar troca de perfil para ${target}?`)) return;
    try {
      let uid = firebaseUid;
      if (!uid) {
        const typed = window.prompt(
          "UID do login Firebase para sincronizar a claim (vazio = só banco):"
        );
        uid = typed ? typed.trim() : null;
      }
      const t = await fbUser!.getIdToken();
      const data = await api(`/api/admin/users/${id}/role`, t, {
        method: "PATCH",
        body: JSON.stringify({ role: next, firebaseUid: uid ?? undefined }),
      });
      if (data.hint) window.alert(data.hint);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (!fbUser) {
    return (
      <div className="card" style={{ maxWidth: 440 }}>
        <h1>Admin — login</h1>
        {err && (
          <p className="alert alert-error" role="alert">
            {err}
          </p>
        )}
        <form onSubmit={doLogin} className="form">
          <label>
            E-mail
            <input
              type="email"
              name="email"
              spellCheck={false}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              name="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loggingIn}>
            {loggingIn ? "Entrando…" : "Entrar com e-mail/senha"}
          </button>
        </form>
        <p>
          <button className="btn" onClick={doGoogle}>
            Entrar com Google
          </button>
        </p>
        <p className="muted">Use o login master do ensaio para gerir permissões.</p>
      </div>
    );
  }

  const isAdmin = role === "ADMIN_GERAL";
  return (
    <div>
      <h1>Admin — usuários e permissões</h1>
      <div className="card plain">
        Logado: <strong>{fbUser.email}</strong> · role (claim):{" "}
        <span className={`badge ${isAdmin ? "badge-role" : "badge-DRAFT"}`}>
          {role ?? "sem vínculo"}
        </span>{" "}
        <button className="btn" onClick={() => signOut(firebaseClient())}>
          Sair
        </button>
      </div>
      {err && (
        <p className="alert alert-error" role="alert">
          {err}
        </p>
      )}
      {!isAdmin && (
        <p className="alert alert-warn">
          Perfil somente leitura: a API bloqueia criação e troca de role com 403 (RBAC no
          backend, não só botão escondido).
        </p>
      )}
      <h3>Usuários ({users.length})</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Roles</th>
              <th scope="col">Login</th>
              {isAdmin && <th scope="col">Ação</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  {u.roles.length > 0 ? (
                    u.roles.map((r) => (
                      <span key={r} className="badge badge-role" style={{ marginRight: 4 }}>
                        {r}
                      </span>
                    ))
                  ) : (
                    "—"
                  )}
                </td>
                <td>{u.firebaseUid ? "vinculado" : "não"}</td>
                {isAdmin && (
                  <td>
                    <button
                      className="btn"
                      onClick={() =>
                        changeRole(
                          u.id,
                          u.roles.includes("ADMIN_GERAL")
                            ? "NIVEL_3_VISUALIZACAO"
                            : "ADMIN_GERAL",
                          u.firebaseUid
                        )
                      }
                    >
                      Tornar {u.roles.includes("ADMIN_GERAL") ? "Nível 3" : "Admin"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Criar usuário interno</h3>
          <form onSubmit={createUser} className="form">
            <label>
              Nome
              <input
                name="name"
                autoComplete="off"
                value={nName}
                onChange={(e) => setNName(e.target.value)}
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                name="email"
                autoComplete="off"
                spellCheck={false}
                value={nEmail}
                onChange={(e) => setNEmail(e.target.value)}
              />
            </label>
            <div className="form-row">
              <label style={{ flex: 1 }}>
                Setor
                <select value={nDept} onChange={(e) => setNDept(e.target.value)}>
                  <option value="">—</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.acronym})
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                Perfil
                <select value={nRole} onChange={(e) => setNRole(e.target.value)}>
                  <option value="NIVEL_3_VISUALIZACAO">Nível 3 — visualização</option>
                  <option value="ADMIN_GERAL">Administrador Geral</option>
                </select>
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "Criando…" : "Criar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
