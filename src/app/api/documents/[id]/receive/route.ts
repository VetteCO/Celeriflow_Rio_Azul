// Receber memorando no destino (doc:view — quem vê, recebe).
// Cria movement RECEIVED + auditLog; status volta a OPEN.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUser, auditLog, document, documentMovement } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  const check = requirePerm(session, "doc:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const rows = await db.select().from(document).where(eq(document.id, params.id));
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const me = (
    await db
      .select()
      .from(appUser)
      .then((r) => r.find((u) => u.firebaseUid === check.session.uid))
  )?.id ?? null;

  const mv = await db
    .insert(documentMovement)
    .values({
      documentId: doc.id,
      fromDepartmentId: doc.originDepartmentId,
      toDepartmentId: null,
      action: "RECEIVED",
      note: null,
      actorUserId: me,
    })
    .returning();
  await db.update(document).set({ status: "OPEN" }).where(eq(document.id, doc.id));
  await db.insert(auditLog).values({
    actorType: "USER",
    actorId: check.session.uid,
    action: "DOCUMENT_RECEIVED",
    entityType: "document",
    entityId: doc.id,
    metadata: { movementId: mv[0]!.id },
  });
  return NextResponse.json({ ok: true });
}
