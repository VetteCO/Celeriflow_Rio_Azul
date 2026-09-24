// Documentos — lista (doc:view) + cria memorando (doc:create) com
// numeração transacional, prazos múltiplos e movimento CREATED.
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  appUser,
  auditLog,
  department,
  document,
  documentDeadline,
  documentMovement,
} from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { createDocumentWithNumber, formatNumber } from "@/lib/numbering";

const CreateSchema = z.object({
  type: z.enum(["MEMORANDUM", "OFICIO"]).optional().default("MEMORANDUM"),
  subject: z.string().min(3).max(300),
  body: z.string().min(1).max(100000),
  originDepartmentId: z.string().uuid().nullable().optional(),
  toDepartmentId: z.string().uuid().nullable().optional(),
  deadlines: z
    .array(z.object({ title: z.string().min(1).max(200), dueAt: z.string().datetime() }))
    .max(20)
    .optional()
    .default([]),
});

export async function GET(req: Request) {
  const session = await getSession(req);
  const check = requirePerm(session, "doc:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );
  const rows = await db
    .select()
    .from(document)
    .orderBy(desc(document.createdAt))
    .limit(100);
  const depts = await db.select().from(department);
  const nameOf = (id: string | null) =>
    depts.find((d) => d.id === id)?.acronym ?? "—";
  return NextResponse.json({
    documents: rows
      .filter((d) => d.type === "MEMORANDUM" || d.type === "OFICIO")
      .map((d) => ({
        id: d.id,
        type: d.type,
        displayNumber: formatNumber(d.type, d.number, d.year),
        subject: d.subject,
        status: d.status,
        origin: nameOf(d.originDepartmentId),
        createdAt: d.createdAt,
      })),
    departments: depts,
  });
}

export async function POST(req: Request) {
  const session = await getSession(req);
  const check = requirePerm(session, "doc:create");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "payload inválido", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const body = parsed.data;

  // Vincula o criador ao app_user pelo firebaseUid (se já vinculado).
  const me = session?.uid
    ? (
        await db
          .select()
          .from(appUser)
          .then((rows) => rows.find((u) => u.firebaseUid === session!.uid))
      )?.id ?? null
    : null;

  const doc = await createDocumentWithNumber({
    type: body.type,
    subject: body.subject,
    body: body.body,
    originDepartmentId: body.originDepartmentId ?? null,
    createdById: me,
    toDepartmentId: body.toDepartmentId ?? null,
  });

  for (const dl of body.deadlines) {
    await db.insert(documentDeadline).values({
      documentId: doc.id,
      title: dl.title,
      dueAt: new Date(dl.dueAt),
      status: "PENDING",
    });
  }
  await db.insert(documentMovement).values({
    documentId: doc.id,
    fromDepartmentId: body.originDepartmentId ?? null,
    toDepartmentId: body.toDepartmentId ?? null,
    action: "CREATED",
    note: null,
    actorUserId: me,
  });
  await db.insert(auditLog).values({
    actorType: "USER",
    actorId: check.session.uid,
    action: "DOCUMENT_CREATED",
    entityType: "document",
    entityId: doc.id,
    metadata: {
      displayNumber: formatNumber(doc.type, doc.number, doc.year),
      deadlines: body.deadlines.length,
    },
  });
  return NextResponse.json(
    {
      id: doc.id,
      displayNumber: formatNumber(doc.type, doc.number, doc.year),
    },
    { status: 201 }
  );
}
