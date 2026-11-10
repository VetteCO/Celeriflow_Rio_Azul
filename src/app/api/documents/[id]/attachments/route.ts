// Upload de anexo do memorando → Vercel Blob (doc:edit).
// multipart/form-data com campo "file". Metadados em attachment.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachment, auditLog, document } from "@/db/schema";
import { getSession, requirePerm, canAccessDocument, canActInAnyDepartment } from "@/lib/auth";
import { uploadAttachment } from "@/lib/blob";

export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await getSession(req);
  const check = requirePerm(session, "doc:edit");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const doc = await canAccessDocument(check.session, params.id);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await canActInAnyDepartment(check.session, doc.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    file = null;
  }
  if (!file) return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: "máximo 10MB" }, { status: 413 });

  let url: string;
  try {
    url = await uploadAttachment(file.name, file);
  } catch (e) {
    return NextResponse.json(
      { error: "falha no upload (BLOB_READ_WRITE_TOKEN?)" },
      { status: 502 }
    );
  }
  const inserted = await db
    .insert(attachment)
    .values({
      documentId: params.id,
      filename: file.name,
      mimeType: file.type || null,
      storageKey: url,
      size: file.size,
    })
    .returning();
  await db.insert(auditLog).values({
    actorType: "USER",
    actorId: check.session.uid,
    action: "ATTACHMENT_UPLOADED",
    entityType: "document",
    entityId: params.id,
    metadata: { filename: file.name, size: file.size },
  });
  return NextResponse.json({ id: inserted[0]!.id, url: `/api/attachments/${inserted[0]!.id}` }, { status: 201 });
}
