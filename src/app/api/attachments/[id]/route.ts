// Download de anexo (doc:view) — stream do Blob privado com autenticação.
// Anexos nunca têm URL pública direta (LGPD).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachment, auditLog } from "@/db/schema";
import { getSession, requirePerm, canAccessDocument, canActInAnyDepartment } from "@/lib/auth";
import { downloadAttachment } from "@/lib/blob";

export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await getSession(req);
  const check = requirePerm(session, "doc:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const rows = await db.select().from(attachment).where(eq(attachment.id, params.id));
  const file = rows[0];
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await canAccessDocument(check.session, file.documentId)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let data;
  try {
    data = await downloadAttachment(file.storageKey);
  } catch (e) {
    return NextResponse.json(
      { error: "storage indisponível", detail: String((e as Error)?.message ?? e).slice(0, 200) },
      { status: 502 }
    );
  }
  if (!data) return NextResponse.json({ error: "arquivo não encontrado" }, { status: 404 });

  await db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "ATTACHMENT_DOWNLOADED", entityType: "attachment", entityId: file.id });
  return new NextResponse(data.stream, {
    headers: {
      "content-type": file.mimeType || data.contentType,
      "content-length": String(file.size ?? data.size ?? 0),
      "content-disposition": `attachment; filename="${encodeURIComponent(file.filename)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const check = requirePerm(await getSession(req), "doc:edit");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const b = await req.json().catch(() => null);
  if (typeof b?.citizenVisible !== "boolean") return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const [file] = await db.select().from(attachment).where(eq(attachment.id, params.id));
  if (!file || !await canAccessDocument(check.session, file.documentId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await canActInAnyDepartment(check.session, file.documentId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await db.batch([db.update(attachment).set({ citizenVisible: b.citizenVisible }).where(eq(attachment.id, file.id)), db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "ATTACHMENT_VISIBILITY_CHANGED", entityType: "attachment", entityId: file.id, metadata: { citizenVisible: b.citizenVisible } })]);
  return NextResponse.json({ ok: true });
}
