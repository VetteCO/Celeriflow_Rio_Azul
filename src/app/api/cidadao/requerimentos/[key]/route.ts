import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documentMovement, attachment, auditLog } from "@/db/schema";
import { ownedCitizenDocument, citizenWriteGuard } from "@/lib/citizen-auth";
import { citizenHistory } from "@/lib/document-visibility";
import { isCoreWriteConflict } from "@/lib/core-write-guard";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ key: string }> }) {
  const params = await paramsPromise;
  const owned = await ownedCitizenDocument(req, params.key);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const moves = await db.select().from(documentMovement).where(eq(documentMovement.documentId, owned.doc.id)).orderBy(asc(documentMovement.createdAt), asc(documentMovement.id));
  const files = await db.select({ id: attachment.id, filename: attachment.filename, size: attachment.size }).from(attachment).where(and(eq(attachment.documentId, owned.doc.id), eq(attachment.citizenVisible, true)));
  return NextResponse.json({ protocolNumber: owned.request.protocolNumber, subject: owned.doc.subject, description: owned.doc.body, status: owned.doc.status, history: citizenHistory(moves, true), attachments: files.map(f => ({ ...f, url: `/api/cidadao/requerimentos/${params.key}/attachments/${f.id}` })) }, { headers: { "cache-control": "no-store" } });
}
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ key: string }> }) {
  const params = await paramsPromise;
  const owned = await ownedCitizenDocument(req, params.key);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!["OPEN", "IN_TRANSIT"].includes(owned.doc.status)) return NextResponse.json({ error: "request_closed" }, { status: 409 });
  const b = z.object({ text: z.string().trim().min(3).max(20000) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  try { await db.batch([db.execute(sql`SELECT id FROM document WHERE id=${owned.doc.id}::uuid FOR UPDATE`), citizenWriteGuard(owned.doc.id, owned.session), db.insert(documentMovement).values({ documentId: owned.doc.id, action: "CITIZEN_COMPLEMENT", note: b.data.text, visibility: "CITIZEN" }), db.insert(auditLog).values({ actorType: "CITIZEN", actorId: owned.session.uid, action: "CITIZEN_COMPLEMENT", entityType: "document", entityId: owned.doc.id, metadata: { notificationStatus: "INTERNAL_EVENT_RECORDED" } })]); }
  catch (error) { if (isCoreWriteConflict(error)) return NextResponse.json({ error: "request_changed" }, { status: 409 }); throw error; }
  return NextResponse.json({ ok: true }, { status: 201 });
}
