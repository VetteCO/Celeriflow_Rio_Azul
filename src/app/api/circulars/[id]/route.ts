// Detalhe da circular: painel lido/não lido por servidor (doc:view ou circular:view).
// Ao abrir como destinatário, registra firstReadAt (imutável via unique +
// onConflictDoNothing) e retorna o recibo.
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appUser,
  department,
  document,
  documentMovement,
  documentReadReceipt,
  documentRecipient,
} from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { formatNumber } from "@/lib/numbering";

async function recordRead(documentId: string, userId: string) {
  await db
    .insert(documentReadReceipt)
    .values({ documentId, userId })
    .onConflictDoNothing();
  const rows = await db
    .select()
    .from(documentReadReceipt)
    .where(
      and(
        eq(documentReadReceipt.documentId, documentId),
        eq(documentReadReceipt.userId, userId)
      )
    );
  return rows[0] ?? null;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  const check = requirePerm(session, "circular:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const { searchParams } = new URL(req.url);
  const onlyUnread = searchParams.get("unread") === "1";

  const rows = await db.select().from(document).where(eq(document.id, params.id));
  const doc = rows[0];
  if (!doc || doc.type !== "CIRCULAR")
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const me = (
    await db
      .select()
      .from(appUser)
      .then((r) => r.find((u) => u.firebaseUid === check.session.uid))
  ) ?? null;

  // Leitura do próprio visualizador (prova individual de leitura).
  let myReceipt = null;
  if (me) myReceipt = await recordRead(doc.id, me.id);

  const [recipients, receipts, users, depts, movements] = await Promise.all([
    db.select().from(documentRecipient).where(eq(documentRecipient.documentId, doc.id)),
    db.select().from(documentReadReceipt).where(eq(documentReadReceipt.documentId, doc.id)),
    db.select().from(appUser),
    db.select().from(department),
    db.select().from(documentMovement).where(eq(documentMovement.documentId, doc.id)),
  ]);

  const individual = recipients
    .filter((r) => r.userId)
    .map((r) => {
      const u = users.find((x) => x.id === r.userId);
      const d = depts.find((x) => x.id === (r.departmentId ?? u?.departmentId));
      const rc = receipts.find((x) => x.userId === r.userId);
      return {
        userId: r.userId,
        name: u?.name ?? "—",
        email: u?.email ?? "—",
        sector: d?.acronym ?? d?.name ?? "—",
        read: !!rc,
        firstReadAt: rc?.firstReadAt ?? null,
      };
    });
  const filtered = onlyUnread ? individual.filter((r) => !r.read) : individual;

  return NextResponse.json({
    circular: {
      id: doc.id,
      displayNumber: formatNumber(doc.type, doc.number, doc.year),
      subject: doc.subject,
      body: doc.body,
      urgency: doc.urgency,
      status: doc.status,
      createdAt: doc.createdAt,
    },
    myReceipt: myReceipt
      ? { firstReadAt: myReceipt.firstReadAt }
      : null,
    stats: {
      total: individual.length,
      read: individual.filter((r) => r.read).length,
      unread: individual.filter((r) => !r.read).length,
    },
    recipients: filtered,
    movements: movements.map((m) => ({ action: m.action, note: m.note, at: m.createdAt })),
  });
}
