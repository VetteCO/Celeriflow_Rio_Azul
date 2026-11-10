import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachment, auditLog } from "@/db/schema";
import { ownedCitizenDocument } from "@/lib/citizen-auth";
import { downloadAttachment } from "@/lib/blob";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ key: string; id: string }> }) {
  const params = await paramsPromise;
  const owned = await ownedCitizenDocument(req, params.key);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [file] = await db.select().from(attachment).where(and(eq(attachment.id, params.id), eq(attachment.documentId, owned.doc.id), eq(attachment.citizenVisible, true)));
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const data = await downloadAttachment(file.storageKey);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.insert(auditLog).values({ actorType: "CITIZEN", actorId: owned.session.uid, action: "CITIZEN_ATTACHMENT_DOWNLOADED", entityType: "attachment", entityId: file.id });
  return new NextResponse(data.stream, { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${encodeURIComponent(file.filename)}"`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
