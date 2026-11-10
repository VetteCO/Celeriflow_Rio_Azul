import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // A CPF supplied by the client is not proof of an external identity.
  return NextResponse.json({ error: "Vínculo gov.br indisponível." }, { status: 503 });
}
