"use client";
import { useEffect, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { firebaseClient } from "@/lib/firebase-client";

export function useExternalAccount() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [revision, setRevision] = useState(0);
  useEffect(() => onIdTokenChanged(firebaseClient(), (current) => { setUser(current); setRevision((v) => v + 1); }), []);
  async function refresh() {
    const current = firebaseClient().currentUser;
    if (current) { await current.reload(); await current.getIdToken(true); }
    setUser(current); setRevision((v) => v + 1);
  }
  return { user, revision, refresh };
}

const messages: Record<string, string> = {
  verified_email_required: "Confirme seu e-mail para acessar seus protocolos.",
  not_found: "Protocolo indisponível para esta conta.", request_closed: "Este protocolo está encerrado e não aceita complementações.",
  invalid_payload: "Confira os campos informados.", unauthorized: "Entre novamente para continuar.",
  intake_department_not_configured: "O recebimento de novos requerimentos está temporariamente indisponível. Procure o atendimento municipal.",
  identity_confirmation_required: "O cadastro informado utiliza outro e-mail. Procure o atendimento para confirmar e atualizar seus dados.",
  file_required: "Selecione um arquivo para anexar.", maximum_10MB: "O arquivo deve ter no máximo 10 MB.",
  "auth/email-already-in-use": "Já existe uma conta com este e-mail. Entre ou recupere sua senha.",
  "auth/invalid-credential": "Confira seu e-mail e sua senha.", "auth/weak-password": "Escolha uma senha mais forte.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos para tentar novamente.",
};
export function externalError(error: unknown) {
  const e = error as { code?: string; message?: string };
  return messages[e.code ?? ""] ?? messages[e.message ?? ""] ?? (e.message?.startsWith("auth/") || e.code?.startsWith("auth/") ? "Não foi possível concluir a operação de acesso. Tente novamente." : e.message && !/^[a-z0-9_]+$/.test(e.message) ? e.message : "Não foi possível concluir a operação. Tente novamente.");
}
export async function externalRequest(path: string, init?: RequestInit) {
  const user = firebaseClient().currentUser;
  if (!user) throw new Error("Entre na sua conta para continuar.");
  const token = await user.getIdToken();
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error ?? "Não foi possível concluir a operação."); }
  return response;
}
