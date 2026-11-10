// Detalhe da circular: painel lido/não lido por servidor (doc:view ou circular:view).
// Ao abrir como destinatário, registra firstReadAt (imutável via unique +
// onConflictDoNothing) e retorna o recibo.
import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  appUser,
  department,
  documentMovement,
  documentReadReceipt,
  documentRecipient,
} from "@/db/schema";
import { getSession, requirePerm, canAccessDocument, isRecipient } from "@/lib/auth";
import { formatNumber, sanitizeDocumentHtml } from "@/lib/numbering";
import { circularPopulation, recordCircularRead } from "@/lib/circulars";
import { internalHistory } from "@/lib/document-visibility";

export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await getSession(req);
  const check = requirePerm(session, "circular:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const { searchParams } = new URL(req.url);
  const onlyUnread = searchParams.get("unread") === "1";

  const doc = await canAccessDocument(check.session, params.id);
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
  if (me && await isRecipient(check.session, doc.id)) {
    const firstReadAt = await recordCircularRead(check.session, doc.id);
    if (firstReadAt) myReceipt = { firstReadAt };
  }

  const [recipients, receipts, users, depts, movements] = await Promise.all([
    db.select().from(documentRecipient).where(eq(documentRecipient.documentId, doc.id)),
    db.select().from(documentReadReceipt).where(eq(documentReadReceipt.documentId, doc.id)),
    db.select().from(appUser),
    db.select().from(department),
    db.select().from(documentMovement).where(eq(documentMovement.documentId, doc.id)).orderBy(asc(documentMovement.createdAt), asc(documentMovement.id)),
  ]);

  const { population, stats } = circularPopulation(recipients, receipts);
  const individual = population
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
      displayNumber: formatNumber(doc.type, doc.number, doc.year, doc.businessCode),
      subject: doc.subject,
      body: sanitizeDocumentHtml(doc.body),
      urgency: doc.urgency,
      status: doc.status,
      circularReplyMode: doc.circularReplyMode,
      createdAt: doc.createdAt,
    },
    myReceipt: myReceipt
      ? { firstReadAt: myReceipt.firstReadAt }
      : null,
    stats,
    canEditRecipients: doc.createdById === check.session.userId && ["OPEN", "IN_TRANSIT"].includes(doc.status),
    departmentIds: Array.from(new Set(recipients.filter(r => r.recipientType !== "CANCELLED").map(r => r.departmentId).filter(Boolean))),
    recipients: filtered,
    movements: internalHistory(doc, movements, check.session).map((m) => ({ action: m.action, note: m.note, at: m.createdAt })),
  });
}
