import { NextResponse } from "next/server";

// Identity linking is enabled only after the provider token exchange is implemented.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/admin?govbr=cancelled", url.origin));
  }
  return NextResponse.json({ error: "Autenticação gov.br indisponível." }, { status: 503 });
}
