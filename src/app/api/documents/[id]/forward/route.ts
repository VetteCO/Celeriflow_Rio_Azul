// Tramitar memorando origem → destino (doc:forward).
// Cria movement FORWARDED + auditLog; status vira IN_TRANSIT.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appUser, auditLog, document, documentMovement } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";

const ForwardSchema = z.object({
  toDepartmentId: z.string().uuid(),
  note: z.string().max(2000).optional().default(""),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  const check = requirePerm(session, "doc:forward");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const parsed = ForwardSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const rows = await db.select().from(document).where(eq(document.id, params.id));
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (doc.status === "ARCHIVED" || doc.status === "CONCLUDED")
    return NextResponse.json({ error: "documento encerrado" }, { status: 409 });

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
      toDepartmentId: parsed.data.toDepartmentId,
      action: "FORWARDED",
      note: parsed.data.note || null,
      actorUserId: me,
    })
    .returning();
  await db
    .update(document)
    .set({ status: "IN_TRANSIT" })
    .where(eq(document.id, doc.id));
  await db.insert(auditLog).values({
    actorType: "USER",
    actorId: check.session.uid,
    action: "DOCUMENT_FORWARDED",
    entityType: "document",
    entityId: doc.id,
    metadata: { to: parsed.data.toDepartmentId, movementId: mv[0]!.id },
  });
  return NextResponse.json({ ok: true, movementId: mv[0]!.id });
}
