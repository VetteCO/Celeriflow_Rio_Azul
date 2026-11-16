"use client";
// Sessão Firebase compartilhada: usuário + idToken + role (custom claim).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { firebaseClient } from "@/lib/firebase-client";
import { PERMS, type Role } from "@/lib/rbac";

export const ROLE_LABELS: Record<string, string> = {
  ADMIN_GERAL: "Administrador geral",
  ADMIN_LOCAL: "Administrador local",
  NIVEL_1: "Nível 1",
  NIVEL_2: "Nível 2",
  NIVEL_3_VISUALIZACAO: "Nível 3 — visualização",
  AUDITOR: "Auditor",
};

const messages: Record<string, string> = {
  unauthorized: "Entre com uma conta ativa para continuar.",
  forbidden: "Seu perfil não permite realizar esta operação.",
  not_found: "O registro não foi encontrado ou não está disponível para sua conta.",
  invalid_payload: "Confira o preenchimento dos campos obrigatórios.",
  email_exists: "Já existe um servidor com este e-mail.",
  firebase_email_exists: "Este e-mail já possui acesso cadastrado.",
  inactive_department: "Selecione um setor ativo.",
  migration_required: "Este serviço está temporariamente indisponível. Entre em contato com o suporte.",
  provisioning_failed: "Não foi possível concluir o cadastro de acesso. Tente novamente.",
  provisioning_pending_recovery: "O cadastro foi salvo com acesso suspenso. Reabra o servidor para concluir a ativação.",
  invalid_transition: "A situação atual do documento não permite esta operação.",
  conflict: "O registro foi atualizado por outra pessoa. Atualize a página antes de continuar.",
  authorization_changed: "As permissões ou o estado do registro mudaram. Atualize a página antes de continuar.",
  invalid_sector_transition: "A situação deste setor não permite a operação selecionada.",
  administrative_department_required: "Selecione ao menos um setor administrado para o Administrador Local.",
  active_reallocation_required: "Selecione um setor ativo para receber os servidores e atividades.",
  reallocate_subdepartments_first: "Realoque primeiro os subsetores ativos.",
  global_admin_required: "Esta alteração exige um Administrador Geral.",
  empty_document: "Informe o conteúdo do documento.",
  reply_required: "Informe o texto da resposta.",
};

export async function api(path: string, init?: RequestInit) {
  const token = await firebaseClient().currentUser?.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  }).catch(() => { throw new Error("Não foi possível conectar ao serviço. Confira sua conexão e tente novamente."); });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error;
    throw new Error(message ? messages[message] ?? (/^[a-z0-9_]+$/.test(message) ? "Não foi possível concluir a operação. Confira os dados e tente novamente." : message) : `Não foi possível concluir a operação (${res.status}).`);
  }
  if (init?.method && init.method !== "GET" && path.startsWith("/api/admin/")) window.dispatchEvent(new Event("session:refresh"));
  return data;
}

export async function getToken() {
  return firebaseClient().currentUser?.getIdToken() ?? null;
}

type SessionState = { user: User | null | undefined; role: string | null; permissions: string[]; refresh: () => Promise<void> };
const SessionContext = createContext<SessionState>({ user: undefined, role: null, permissions: [], refresh: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = firebaseClient().currentUser;
    const version = ++generation.current;
    if (!current) { setRole(null); setPermissions([]); setUser(null); return; }
    const applyClaimFallback = async () => {
      try {
        const tokenResult = await current.getIdTokenResult();
        if (version !== generation.current) return;
        const claimRole = typeof tokenResult.claims.role === "string" ? tokenResult.claims.role : null;
        if (claimRole && Object.prototype.hasOwnProperty.call(PERMS, claimRole)) {
          setRole(claimRole);
          setPermissions([...PERMS[claimRole as Role]]);
          setUser(current);
          return;
        }
      } catch {
        // Segue para estado sem perfil de servidor se não houver claim válido.
      }
      if (version === generation.current) { setRole(null); setPermissions([]); setUser(current); }
    };
    try {
      const token = await current.getIdToken();
      const response = await fetch("/api/admin/me", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) { await applyClaimFallback(); return; }
      const data = await response.json();
      if (version !== generation.current) return;
      setRole(data?.role ?? data?.roles?.[0] ?? null);
      setPermissions(data?.permissions ?? []);
      setUser(current);
    } catch {
      await applyClaimFallback();
    }
  }, []);
  useEffect(() => {
    const epoch = generation;
    const unsubscribe = onIdTokenChanged(firebaseClient(), () => { void refresh(); });
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("session:refresh", focus);
    const heartbeat = window.setInterval(focus, 60000);
    return () => { epoch.current++; window.clearInterval(heartbeat); unsubscribe(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); window.removeEventListener("session:refresh", focus); };
  }, [refresh]);
  return <SessionContext.Provider value={{ user, role, permissions, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() { return useContext(SessionContext); }
