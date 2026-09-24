// Adicionar prazo ao memorando (doc:edit).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLog, document, documentDeadline } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";

const Schema = z.object({
  title: z.string().min(1).max(200),
  dueAt: z.string().datetime(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  const check = requirePerm(session, "doc:edit");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const rows = await db.select().from(document).where(eq(document.id, params.id));
  if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const inserted = await db
    .insert(documentDeadline)
    .values({
      documentId: params.id,
      title: parsed.data.title,
      dueAt: new Date(parsed.data.dueAt),
      status: "PENDING",
    })
    .returning();
  await db.insert(auditLog).values({
    actorType: "USER",
    actorId: check.session.uid,
    action: "DEADLINE_ADDED",
    entityType: "document",
    entityId: params.id,
    metadata: { title: parsed.data.title, dueAt: parsed.data.dueAt },
  });
  return NextResponse.json({ id: inserted[0]!.id }, { status: 201 });
}
