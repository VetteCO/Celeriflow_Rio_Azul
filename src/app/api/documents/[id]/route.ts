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
} from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { formatNumber } from "@/lib/numbering";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession(_req);
  const check = requirePerm(session, "doc:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const rows = await db.select().from(document).where(eq(document.id, params.id));
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [deadlines, movements, files, depts, users] = await Promise.all([
    db.select().from(documentDeadline).where(eq(documentDeadline.documentId, doc.id)),
    db
      .select()
      .from(documentMovement)
      .where(eq(documentMovement.documentId, doc.id))
      .orderBy(asc(documentMovement.createdAt)),
    db.select().from(attachment).where(eq(attachment.documentId, doc.id)),
    db.select().from(department),
    db.select().from(appUser),
  ]);
  const deptName = (id: string | null) =>
    depts.find((d) => d.id === id)?.name ?? "—";
  const userName = (id: string | null) =>
    users.find((u) => u.id === id)?.name ?? "sistema";

  return NextResponse.json({
    document: {
      id: doc.id,
      displayNumber: formatNumber(doc.type, doc.number, doc.year),
      subject: doc.subject,
      body: doc.body,
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
      actor: userName(m.actorUserId),
      at: m.createdAt,
    })),
    attachments: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      url: f.storageKey,
      size: f.size,
    })),
    departments: depts,
  });
}
