// Registro explícito de leitura (o GET do detalhe já registra
// automaticamente; este endpoint serve para confirmação via botão).
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUser, document, documentReadReceipt } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  const check = requirePerm(session, "circular:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const rows = await db.select().from(document).where(eq(document.id, params.id));
  if (!rows[0] || rows[0].type !== "CIRCULAR")
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const me = (
    await db
      .select()
      .from(appUser)
      .then((r) => r.find((u) => u.firebaseUid === check.session.uid))
  );
  if (!me) return NextResponse.json({ error: "unlinked_user" }, { status: 403 });

  await db
    .insert(documentReadReceipt)
    .values({ documentId: params.id, userId: me.id })
    .onConflictDoNothing();
  const rc = await db
    .select()
    .from(documentReadReceipt)
    .where(
      and(
        eq(documentReadReceipt.documentId, params.id),
        eq(documentReadReceipt.userId, me.id)
      )
    );
  return NextResponse.json({ firstReadAt: rc[0]?.firstReadAt ?? null });
}
