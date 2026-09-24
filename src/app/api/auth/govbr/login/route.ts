import { NextResponse } from "next/server";
import { govbrConfigured, govbrLoginUrl } from "@/lib/govbr";

// Inicia o login: real (OIDC) se configurado, senão tela simulada de ensaio.
export async function GET(req: Request) {
  const state = Math.random().toString(36).slice(2);
  if (govbrConfigured) {
    return NextResponse.redirect(govbrLoginUrl(state));
  }
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/govbr-simulado?state=${state}`, url.origin));
}
