import { NextResponse } from "next/server";
import { db } from "@/db";
import { attachment, auditLog } from "@/db/schema";
import { ownedCitizenDocument, citizenWriteGuard } from "@/lib/citizen-auth";
import { sql } from "drizzle-orm";
import { isCoreWriteConflict } from "@/lib/core-write-guard";
import { uploadAttachment } from "@/lib/blob";
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ key: string }> }) {
  const params = await paramsPromise;
  const owned = await ownedCitizenDocument(req, params.key);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!["OPEN", "IN_TRANSIT"].includes(owned.doc.status)) return NextResponse.json({ error: "request_closed" }, { status: 409 });
  const form = await req.formData().catch(() => null), file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "maximum_10MB" }, { status: 413 });
  const storageKey = await uploadAttachment(file.name, file);
  try {
  const [, , rows] = await db.batch([db.execute(sql`SELECT id FROM document WHERE id=${owned.doc.id}::uuid FOR UPDATE`), citizenWriteGuard(owned.doc.id, owned.session), db.insert(attachment).values({ documentId: owned.doc.id, filename: file.name, size: file.size, mimeType: file.type || "application/octet-stream", storageKey, citizenVisible: true }).returning(), db.insert(auditLog).values({ actorType: "CITIZEN", actorId: owned.session.uid, action: "CITIZEN_ATTACHMENT_UPLOADED", entityType: "document", entityId: owned.doc.id })]);
  return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (error) {
    if (isCoreWriteConflict(error)) {
      const { del } = await import("@vercel/blob"); await del(storageKey, { token: process.env.BLOB_READ_WRITE_TOKEN?.trim().replace(/^"|"$/g, "") });
      return NextResponse.json({ error: "request_changed" }, { status: 409 });
    }
    return NextResponse.json({ error: "attachment_persistence_uncertain" }, { status: 503 });
  }
}
