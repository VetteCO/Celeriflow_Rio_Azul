// Circulares — lista com placar de leitura (doc:view) + cria (doc:create).
// Criação: tipo CIRCULAR + urgência + departmentIds[] expandidos para
// destinatários individuais (usuários ativos dos setores).
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  appUser,
  auditLog,
  department,
  document,
  documentMovement,
  documentReadReceipt,
  documentRecipient,
} from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { createDocumentWithNumber, formatNumber } from "@/lib/numbering";

const CreateSchema = z.object({
  subject: z.string().min(3).max(300),
  body: z.string().min(1).max(100000),
  urgency: z.enum(["URGENT", "INFORMATIVE"]),
  originDepartmentId: z.string().uuid().nullable().optional(),
  departmentIds: z.array(z.string().uuid()).min(1).max(20),
});

export async function GET(req: Request) {
  const session = await getSession(req);
  const check = requirePerm(session, "circular:view");
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
  const circulars = rows.filter((d) => d.type === "CIRCULAR");
  const receipts = await db.select().from(documentReadReceipt);
  const recipients = await db.select().from(documentRecipient);
  const depts = await db.select().from(department);

  return NextResponse.json({
    circulars: circulars.map((d) => {
      const total = recipients.filter((r) => r.documentId === d.id).length;
      const read = receipts.filter((r) => r.documentId === d.id).length;
      return {
        id: d.id,
        displayNumber: formatNumber(d.type, d.number, d.year),
        subject: d.subject,
        urgency: d.urgency,
        status: d.status,
        createdAt: d.createdAt,
        total,
        read,
        unread: total - read,
      };
    }),
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
  if (!parsed.success)
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  const body = parsed.data;

  const me = (
    await db
      .select()
      .from(appUser)
      .then((rows) => rows.find((u) => u.firebaseUid === check.session.uid))
  )?.id ?? null;

  const doc = await createDocumentWithNumber({
    type: "CIRCULAR",
    subject: body.subject,
    body: body.body,
    originDepartmentId: body.originDepartmentId ?? null,
    createdById: me,
  });
  await db.update(document).set({ urgency: body.urgency }).where(eq(document.id, doc.id));

  // Expansão setor → usuários ativos (destinatários individuais).
  const users = await db.select().from(appUser);
  const targets = users.filter(
    (u) => u.active && u.departmentId && body.departmentIds.includes(u.departmentId)
  );
  for (const deptId of body.departmentIds) {
    await db.insert(documentRecipient).values({
      documentId: doc.id,
      departmentId: deptId,
      userId: null,
      recipientType: "TO",
    });
  }
  for (const u of targets) {
    await db.insert(documentRecipient).values({
      documentId: doc.id,
      departmentId: u.departmentId,
      userId: u.id,
      recipientType: "TO",
    });
  }
  await db.insert(documentMovement).values({
    documentId: doc.id,
    fromDepartmentId: body.originDepartmentId ?? null,
    toDepartmentId: null,
    action: "CREATED",
    note: `Circular ${body.urgency === "URGENT" ? "Urgente" : "Informativa"} para ${body.departmentIds.length} setor(es), ${targets.length} servidor(es)`,
    actorUserId: me,
  });
  await db.insert(auditLog).values({
    actorType: "USER",
    actorId: check.session.uid,
    action: "CIRCULAR_CREATED",
    entityType: "document",
    entityId: doc.id,
    metadata: {
      displayNumber: formatNumber(doc.type, doc.number, doc.year),
      urgency: body.urgency,
      sectors: body.departmentIds.length,
      recipients: targets.length,
    },
  });
  return NextResponse.json(
    {
      id: doc.id,
      displayNumber: formatNumber(doc.type, doc.number, doc.year),
      recipients: targets.length,
    },
    { status: 201 }
  );
}
