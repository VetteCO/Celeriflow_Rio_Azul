import { NextResponse } from "next/server";
import { db } from "@/db";
import { attachment, auditLog } from "@/db/schema";
import { ownedCitizenDocument } from "@/lib/citizen-auth";
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
  const [rows] = await db.batch([db.insert(attachment).values({ documentId: owned.doc.id, filename: file.name, size: file.size, mimeType: file.type || "application/octet-stream", storageKey, citizenVisible: true }).returning(), db.insert(auditLog).values({ actorType: "CITIZEN", actorId: owned.session.uid, action: "CITIZEN_ATTACHMENT_UPLOADED", entityType: "document", entityId: owned.doc.id })]);
  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
