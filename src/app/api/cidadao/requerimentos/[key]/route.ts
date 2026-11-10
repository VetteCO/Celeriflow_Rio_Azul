import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documentMovement, attachment, auditLog } from "@/db/schema";
import { ownedCitizenDocument } from "@/lib/citizen-auth";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ key: string }> }) {
  const params = await paramsPromise;
  const owned = await ownedCitizenDocument(req, params.key);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const moves = await db.select().from(documentMovement).where(eq(documentMovement.documentId, owned.doc.id)).orderBy(asc(documentMovement.createdAt), asc(documentMovement.id));
  const files = await db.select({ id: attachment.id, filename: attachment.filename, size: attachment.size }).from(attachment).where(and(eq(attachment.documentId, owned.doc.id), eq(attachment.citizenVisible, true)));
  return NextResponse.json({ protocolNumber: owned.request.protocolNumber, subject: owned.doc.subject, description: owned.doc.body, status: owned.doc.status, history: moves.filter(m => m.action !== "INTERNAL_NOTE").map(m => ({ id: m.id, action: m.action, at: m.createdAt, note: m.visibility === "CITIZEN" ? m.note : null })), attachments: files.map(f => ({ ...f, url: `/api/cidadao/requerimentos/${params.key}/attachments/${f.id}` })) }, { headers: { "cache-control": "no-store" } });
}
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ key: string }> }) {
  const params = await paramsPromise;
  const owned = await ownedCitizenDocument(req, params.key);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!["OPEN", "IN_TRANSIT"].includes(owned.doc.status)) return NextResponse.json({ error: "request_closed" }, { status: 409 });
  const b = z.object({ text: z.string().trim().min(3).max(20000) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  await db.batch([db.insert(documentMovement).values({ documentId: owned.doc.id, action: "CITIZEN_COMPLEMENT", note: b.data.text, visibility: "CITIZEN" }), db.insert(auditLog).values({ actorType: "CITIZEN", actorId: owned.session.uid, action: "CITIZEN_COMPLEMENT", entityType: "document", entityId: owned.doc.id })]);
  return NextResponse.json({ ok: true }, { status: 201 });
}
