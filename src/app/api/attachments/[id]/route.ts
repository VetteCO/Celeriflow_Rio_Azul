// Download de anexo (doc:view) — stream do Blob privado com autenticação.
// Anexos nunca têm URL pública direta (LGPD).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachment } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { downloadAttachment } from "@/lib/blob";

export async function GET(req: Request, { params }: { params: { id: string } }) {
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

  return new NextResponse(data.stream, {
    headers: {
      "content-type": file.mimeType || data.contentType,
      "content-length": String(file.size ?? data.size ?? 0),
      "content-disposition": `attachment; filename="${encodeURIComponent(file.filename)}"`,
      "cache-control": "private, max-age=60",
    },
  });
}
