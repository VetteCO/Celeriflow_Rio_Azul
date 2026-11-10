// Detalhe do documento: dados + prazos + timeline (movements) + anexos (doc:view).
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appUser,
  attachment,
  department,
  document,
  documentDeadline,
  documentMovement,
  documentParticipation,
} from "@/db/schema";
import { getSession, requirePerm, canAccessDocument } from "@/lib/auth";
import { formatNumber, sanitizeDocumentHtml } from "@/lib/numbering";

export async function GET(
  _req: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  const session = await getSession(_req);
  const check = requirePerm(session, "doc:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const doc = await canAccessDocument(check.session, params.id);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [deadlines, movements, files, depts, users, participation] = await Promise.all([
    db.select().from(documentDeadline).where(eq(documentDeadline.documentId, doc.id)),
    db
      .select()
      .from(documentMovement)
      .where(eq(documentMovement.documentId, doc.id))
      .orderBy(asc(documentMovement.createdAt), asc(documentMovement.id)),
    db.select().from(attachment).where(eq(attachment.documentId, doc.id)),
    db.select().from(department),
    db.select().from(appUser),
    db.select().from(documentParticipation).where(eq(documentParticipation.documentId, doc.id)),
  ]);
  const deptName = (id: string | null) =>
    depts.find((d) => d.id === id)?.name ?? "—";
  const userName = (id: string | null) =>
    users.find((u) => u.id === id)?.name ?? "sistema";

  return NextResponse.json({
    participation,
    document: {
      id: doc.id,
      displayNumber: formatNumber(doc.type, doc.number, doc.year, doc.businessCode),
      type: doc.type,
      accessLevel: doc.accessLevel,
      subject: doc.subject,
      body: sanitizeDocumentHtml(doc.body),
      status: doc.status,
      origin: deptName(doc.originDepartmentId),
      createdAt: doc.createdAt,
      publicKey: doc.publicKey,
    },
    deadlines: deadlines.map((d) => ({
      id: d.id,
      title: d.title,
      dueAt: d.dueAt,
      status: d.status,
    })),
    timeline: movements.map((m) => ({
      id: m.id,
      action: m.action,
      from: deptName(m.fromDepartmentId),
      to: deptName(m.toDepartmentId),
      note: m.note,
      visibility: m.visibility,
      actor: userName(m.actorUserId),
      at: m.createdAt,
    })),
    attachments: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      url: `/api/attachments/${f.id}`,
      size: f.size,
      citizenVisible: f.citizenVisible,
    })),
    departments: depts,
  });
}
