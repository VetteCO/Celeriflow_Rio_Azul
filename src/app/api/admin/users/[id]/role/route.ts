// PATCH /api/admin/users/[id]/role — troca role (requer admin:users).
// Atualiza user_role + custom claim Firebase (se firebaseUid vinculado) + auditLog.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUser, userRole, role, auditLog } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { setRoleClaim } from "@/lib/firebase-admin";

const VALID = ["ADMIN_GERAL", "NIVEL_3_VISUALIZACAO"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  const check = requirePerm(session, "admin:users");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const body = (await req.json().catch(() => null)) as {
    role?: string;
    firebaseUid?: string | null;
  } | null;
  if (!body || !VALID.includes(body.role as (typeof VALID)[number])) {
    return NextResponse.json(
      { error: "role deve ser ADMIN_GERAL ou NIVEL_3_VISUALIZACAO" },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(appUser)
    .where(eq(appUser.id, params.id));
  const user = rows[0];
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const target = await db
    .select()
    .from(role)
    .then((r) => r.find((x) => x.name === body.role));
  if (!target)
    return NextResponse.json({ error: "role_not_seeded" }, { status: 500 });

  // Troca atômica simples: apaga vínculos e insere o novo.
  const existing = await db
    .select()
    .from(userRole)
    .where(eq(userRole.userId, user.id));
  for (const l of existing) {
    await db
      .delete(userRole)
      .where(eq(userRole.userId, l.userId));
  }
  await db.insert(userRole).values({ userId: user.id, roleId: target.id });

  const firebaseUid = body.firebaseUid ?? user.firebaseUid;
  if (body.firebaseUid !== undefined && body.firebaseUid !== user.firebaseUid) {
    await db
      .update(appUser)
      .set({ firebaseUid: body.firebaseUid })
      .where(eq(appUser.id, user.id));
  }
  if (firebaseUid) {
    await setRoleClaim(
      firebaseUid,
      body.role as "ADMIN_GERAL" | "NIVEL_3_VISUALIZACAO"
    );
  }
  await db.insert(auditLog).values({
    actorType: "USER",
    actorId: check.session.uid,
    action: "USER_ROLE_CHANGED",
    entityType: "app_user",
    entityId: user.id,
    metadata: { email: user.email, role: body.role, claimSynced: !!firebaseUid },
  });
  return NextResponse.json({
    ok: true,
    claimSynced: !!firebaseUid,
    hint: firebaseUid
      ? null
      : "usuário sem login Firebase vinculado — crie o login no Firebase Console com o mesmo e-mail e informe o UID para sincronizar a claim",
  });
}
