"use client";
// Sessão Firebase compartilhada: usuário + idToken + role (custom claim).
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseClient } from "@/lib/firebase-client";

export async function api(path: string, init?: RequestInit) {
  const token = await firebaseClient().currentUser?.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error((data as { error?: string }).error ?? `http_${res.status}`);
  return data;
}

export async function getToken() {
  return firebaseClient().currentUser?.getIdToken() ?? null;
}

export function useSession() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    return onAuthStateChanged(firebaseClient(), async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        return;
      }
      const t = await u.getIdTokenResult();
      setRole((t.claims.role as string) ?? null);
    });
  }, []);
  return { user, role };
}
