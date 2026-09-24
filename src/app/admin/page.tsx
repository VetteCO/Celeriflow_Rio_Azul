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
    setErr(null);
    try {
      await signInWithEmailAndPassword(firebaseClient(), email, pass);
    } catch (e) {
      setErr("login_falhou: confira e-mail/senha e o provider Email/Password no Firebase Console");
    }
  }

  async function doGoogle() {
    setErr(null);
    try {
      await signInWithPopup(firebaseClient(), new GoogleAuthProvider());
    } catch {
      setErr("google_falhou: ative o provider Google no Firebase Console > Authentication");
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
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
    }
  }

  async function changeRole(id: string, next: string, firebaseUid: string | null) {
    setErr(null);
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
      <div style={{ maxWidth: 420 }}>
        <h2>Admin — login</h2>
        {err && <p style={{ color: "crimson" }}>{err}</p>}
        <form onSubmit={doLogin} style={{ display: "grid", gap: 8 }}>
          <input placeholder="e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            placeholder="senha"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <button type="submit">Entrar com e-mail/senha</button>
        </form>
        <p>
          <button onClick={doGoogle}>Entrar com Google</button>
        </p>
        <p style={{ fontSize: 13, opacity: 0.8 }}>
          Ative os providers em Firebase Console &gt; Authentication &gt; Sign-in method, e crie
          os logins com os mesmos e-mails do seed.
        </p>
      </div>
    );
  }

  const isAdmin = role === "ADMIN_GERAL";
  return (
    <div style={{ maxWidth: 860 }}>
      <h2>Admin — usuários e permissões (POC-01)</h2>
      <p>
        Logado: <strong>{fbUser.email}</strong> — role (claim):{" "}
        <strong>{role ?? "nenhuma (sem acesso — peça vínculo ao admin)"}</strong>{" "}
        <button onClick={() => signOut(firebaseClient())}>Sair</button>
      </p>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {!isAdmin && (
        <p style={{ background: "#fff3cd", padding: 8 }}>
          Perfil somente leitura: a API bloqueia criação/troca de role com 403 (RBAC no backend,
          não só botão escondido).
        </p>
      )}
      <h3>Usuários ({users.length})</h3>
      <table cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Roles</th>
            <th>Login vinculado</th>
            {isAdmin && <th>Ação</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.roles.join(", ") || "—"}</td>
              <td>{u.firebaseUid ? "sim" : "não"}</td>
              {isAdmin && (
                <td>
                  <button
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
                    Tornar{" "}
                    {u.roles.includes("ADMIN_GERAL") ? "Nível 3" : "Admin Geral"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {isAdmin && (
        <>
          <h3>Criar usuário interno</h3>
          <form onSubmit={createUser} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
            <input placeholder="nome" value={nName} onChange={(e) => setNName(e.target.value)} />
            <input
              placeholder="e-mail"
              value={nEmail}
              onChange={(e) => setNEmail(e.target.value)}
            />
            <select value={nDept} onChange={(e) => setNDept(e.target.value)}>
              <option value="">setor…</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.acronym})
                </option>
              ))}
            </select>
            <select value={nRole} onChange={(e) => setNRole(e.target.value)}>
              <option value="NIVEL_3_VISUALIZACAO">Nível 3 — visualização</option>
              <option value="ADMIN_GERAL">Administrador Geral</option>
            </select>
            <button type="submit">Criar</button>
          </form>
        </>
      )}
    </div>
  );
}
