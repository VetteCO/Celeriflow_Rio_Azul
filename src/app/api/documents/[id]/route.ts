// Detalhe do documento: dados + prazos + timeline (movements) + anexos (doc:view).
import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { requestContext } from "@/lib/profile-validation";
import { db } from "@/db";
import {
  appUser,
  attachment,
  department,
  document,
  documentDeadline,
  documentMovement,
  documentParticipation,
  userProfile,
} from "@/db/schema";
import { getSession, requirePerm, canAccessDocument } from "@/lib/auth";
import { formatNumber, sanitizeDocumentHtml } from "@/lib/numbering";
import { internalHistory } from "@/lib/document-visibility";

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

  const [deadlines, movements, files, depts, users, participation, profiles, downloads] = await Promise.all([
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
    db.select({ userId: userProfile.userId, details: userProfile.details }).from(userProfile),
    db.execute(sql`SELECT a.entity_id,count(*)::int AS downloads FROM audit_log a JOIN attachment f ON f.id::text=a.entity_id WHERE f.document_id=${doc.id}::uuid AND a.action='ATTACHMENT_DOWNLOADED' GROUP BY a.entity_id`),
  ]);
  const deptName = (id: string | null) =>
    depts.find((d) => d.id === id)?.name ?? "—";
  const userName = (id: string | null) =>
    users.find((u) => u.id === id)?.name ?? "sistema";
  await db.execute(sql`INSERT INTO document_access(document_id,user_id,department_id,ip,user_agent)
    VALUES(${doc.id}::uuid,${check.session.userId}::uuid,${check.session.departmentId}::uuid,${requestContext(_req).ip},${_req.headers.get("user-agent")})`);

  return NextResponse.json({
    participation,
    document: {
      id: doc.id,
      displayNumber: formatNumber(doc.type, doc.number, doc.year, doc.businessCode),
      sequentialNumber: doc.number,
      year: doc.year,
      type: doc.type,
      accessLevel: doc.accessLevel,
      assigneeId: doc.assigneeId,
      assignee: doc.assigneeId ? userName(doc.assigneeId) : null,
      circularReplyMode: doc.circularReplyMode,
      urgency: doc.urgency,
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
    timeline: internalHistory(doc, movements, check.session).map((m) => ({
      id: m.id,
      action: m.action,
      from: deptName(m.fromDepartmentId),
      to: deptName(m.toDepartmentId),
      note: m.note,
      visibility: m.visibility,
      actor: userName(m.actorUserId),
      actorPhoto: profiles.find(profile => profile.userId === m.actorUserId)?.details?.photo || null,
      at: m.createdAt,
    })),
    attachments: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      url: `/api/attachments/${f.id}`,
      size: f.size,
      citizenVisible: f.citizenVisible,
      downloads: Number(downloads.rows.find(row => row.entity_id === f.id)?.downloads ?? 0),
    })),
    departments: depts,
  });
}
