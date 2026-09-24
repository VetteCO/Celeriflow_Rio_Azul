// GET lista usuários + roles + setores (requer doc:view)
// POST cria usuário interno (requer admin:users — NIVEL_3 recebe 403)
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUser, userRole, role, department, auditLog } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession(req);
  const check = requirePerm(session, "doc:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const users = await db.select().from(appUser);
  const roles = await db.select().from(role);
  const links = await db.select().from(userRole);
  const depts = await db.select().from(department);
  const byUser: Record<string, string[]> = {};
  for (const l of links) {
    const r = roles.find((x) => x.id === l.roleId);
    if (r) (byUser[l.userId] ??= []).push(r.name);
  }
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      active: u.active,
      firebaseUid: u.firebaseUid,
      departmentId: u.departmentId,
      roles: byUser[u.id] ?? [],
    })),
    departments: depts,
    roles: roles.map((r) => r.name),
  });
}

export async function POST(req: Request) {
  const session = await getSession(req);
  const check = requirePerm(session, "admin:users");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    departmentId?: string | null;
    role?: "ADMIN_GERAL" | "NIVEL_3_VISUALIZACAO";
  } | null;
  if (!body?.name || !body?.email) {
    return NextResponse.json(
      { error: "name e email são obrigatórios" },
      { status: 400 }
    );
  }
  const inserted = await db
    .insert(appUser)
    .values({
      name: body.name,
      email: body.email,
      departmentId: body.departmentId ?? null,
      active: true,
    })
    .returning();
  const user = inserted[0]!;
  if (body.role) {
    const r = await db
      .select()
      .from(role)
      .then((rows) => rows.find((x) => x.name === body!.role));
    if (r) await db.insert(userRole).values({ userId: user.id, roleId: r.id });
  }
  await db.insert(auditLog).values({
    actorType: "USER",
    actorId: check.session.uid,
    action: "USER_CREATED",
    entityType: "app_user",
    entityId: user.id,
    metadata: { email: user.email, role: body.role ?? null },
  });
  // Vincular Firebase Auth (criar login): o admin cria o usuário no
  // Firebase Console > Authentication com o mesmo e-mail, depois usa
  // PATCH /api/admin/users/[id]/role para vincular firebaseUid + claim.
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
