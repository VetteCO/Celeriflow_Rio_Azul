"use client";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

function config() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  if (!apiKey || !authDomain || !projectId) {
    // Falha explícita e acionável em vez de FirebaseError críptico.
    throw new Error(
      "Autenticação indisponível: configuração ausente. Recarregue a página com Ctrl+F5; se persistir, contate o suporte técnico."
    );
  }
  return { apiKey, authDomain, projectId };
}

export function firebaseClient() {
  if (!getApps().length) initializeApp(config());
  return getAuth();
}
