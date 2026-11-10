import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUser, userProfile, auditLog, userDepartment } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";
import { z } from "zod";
import { phoneField, preferencesField } from "@/lib/profile-validation";
export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [user] = await db.select({ name: appUser.name, email: appUser.email, cpf: appUser.cpf }).from(appUser).where(eq(appUser.id, session.userId));
  const [profile] = await db.select().from(userProfile).where(eq(userProfile.userId, session.userId));
  const secondary = await db.select().from(userDepartment).where(eq(userDepartment.userId, session.userId));
  return NextResponse.json({ ...session, ...user, phone: profile?.phone ?? null, registration: profile?.registration ?? null, position: profile?.position ?? null, preferences: profile?.preferences ?? {}, leaveStart: profile?.leaveStart ?? null, leaveEnd: profile?.leaveEnd ?? null, lastAccessAt: profile?.lastAccessAt ?? null, secondaryDepartmentIds: secondary.map(s => s.departmentId), permissions: Array.from(new Set(session.roles.flatMap(r => Array.from(PERMS[r])))), profile: profile ?? null }, { headers: { "cache-control": "no-store" } });
}

// Self-service never accepts roles, identity, leave, department or activation fields.
const SelfSchema = z.object({ phone: phoneField, preferences: preferencesField }).strict();
export async function PATCH(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = SelfSchema.safeParse(await req.json().catch(() => null));
  if (!b.success || !Object.keys(b.data).length) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const values = { phone: b.data.phone === undefined ? undefined : b.data.phone || null, preferences: b.data.preferences };
  await db.batch([db.insert(userProfile).values({ userId: session.userId, ...values }).onConflictDoUpdate({ target: userProfile.userId, set: values }), db.insert(auditLog).values({ actorType: "USER", actorId: session.userId, action: "SELF_PROFILE_UPDATED", entityType: "app_user", entityId: session.userId, metadata: { fields: Object.keys(b.data) } })]);
  return GET(req);
}
