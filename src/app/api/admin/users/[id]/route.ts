import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appUser, department, auditLog, userDepartment, userProfile } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { firebaseAdminAuth } from "@/lib/firebase-admin";
import { canManageUser, managedDepartmentIds, administrationLock, administrationGuard, isAdministrationConflict } from "@/lib/user-administration";
import { cpfField, phoneField, preferencesField } from "@/lib/profile-validation";
const Schema = z.object({ name: z.string().min(3).max(200).optional(), cpf: cpfField, phone: phoneField, active: z.boolean().optional(), departmentId: z.string().uuid().optional(), secondaryDepartmentIds: z.array(z.string().uuid()).max(30).optional(), registration: z.string().max(100).optional(), position: z.string().max(200).optional(), preferences: preferencesField, leaveStart: z.string().datetime().nullable().optional(), leaveEnd: z.string().datetime().nullable().optional(), resetPassword: z.boolean().optional() });
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const check = requirePerm(await getSession(req), "admin:users");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const b = parsed.data;
  const [user] = await db.select().from(appUser).where(eq(appUser.id, params.id));
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await canManageUser(check.session, user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const global = check.session.roles.includes("ADMIN_GERAL");
  if (b.resetPassword && !global) return NextResponse.json({ error: "self_service_password_reset_required" }, { status: 403 });
  if (b.active === true && !user.firebaseUid) return NextResponse.json({ error: "firebase_link_required" }, { status: 409 });
  const managed = await managedDepartmentIds(check.session);
  const targetIds = [b.departmentId ?? user.departmentId, ...(b.secondaryDepartmentIds ?? [])].filter((s): s is string => !!s);
  if (!global && targetIds.some(id => !managed.includes(id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (user.id === check.session.userId && b.active === false) return NextResponse.json({ error: "self_suspend_forbidden" }, { status: 409 });
  const active = await db.select().from(department).where(eq(department.active, true));
  if (targetIds.some(id => !active.some(d => d.id === id))) return NextResponse.json({ error: "inactive_department" }, { status: 400 });
  const [currentProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, user.id));
  const leaveStart = b.leaveStart === undefined ? currentProfile?.leaveStart : b.leaveStart ? new Date(b.leaveStart) : null;
  const leaveEnd = b.leaveEnd === undefined ? currentProfile?.leaveEnd : b.leaveEnd ? new Date(b.leaveEnd) : null;
  if (leaveStart && leaveEnd && leaveEnd < leaveStart) return NextResponse.json({ error: "invalid_leave_range" }, { status: 400 });
  const profile = { phone: b.phone === undefined ? undefined : b.phone || null, registration: b.registration, position: b.position, preferences: b.preferences, leaveStart: b.leaveStart === undefined ? undefined : leaveStart, leaveEnd: b.leaveEnd === undefined ? undefined : leaveEnd };
  const hasProfile = Object.values(profile).some(v => v !== undefined);
  // Suspension takes effect in SQL before touching Firebase, even if the provider is unavailable.
  try { await db.batch([
    administrationLock(),
    administrationGuard(check.session.userId, user.id, targetIds, null, global),
    db.update(appUser).set({ name: b.name, cpf: b.cpf === undefined ? undefined : b.cpf || null, departmentId: b.departmentId, active: b.active, id: user.id }).where(eq(appUser.id, user.id)),
    db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "USER_UPDATED", entityType: "app_user", entityId: user.id, metadata: { before: { departmentId: user.departmentId, active: user.active }, after: { departmentId: b.departmentId, active: b.active } } }),
    ...(b.secondaryDepartmentIds ? [db.delete(userDepartment).where(eq(userDepartment.userId, user.id)), ...Array.from(new Set(b.secondaryDepartmentIds)).map(departmentId => db.insert(userDepartment).values({ userId: user.id, departmentId }))] : []),
    ...(hasProfile ? [db.insert(userProfile).values({ userId: user.id, ...profile }).onConflictDoUpdate({ target: userProfile.userId, set: profile })] : []),
  ]); } catch (error) { if (isAdministrationConflict(error)) return NextResponse.json({ error: "authorization_changed" }, { status: 409 }); throw error; }
  let resetLink: string | null = null;
  try {
    // Restricted administrators change only SQL activation under the guard.
    // Provider-wide credential/session operations are reserved for global admins.
    if (global && user.firebaseUid && b.active !== undefined) { await firebaseAdminAuth().updateUser(user.firebaseUid, { disabled: !b.active }); if (!b.active) await firebaseAdminAuth().revokeRefreshTokens(user.firebaseUid); }
    if (b.resetPassword) resetLink = await firebaseAdminAuth().generatePasswordResetLink(user.email);
  } catch { return NextResponse.json({ error: "firebase_sync_pending", databaseUpdated: true }, { status: 502 }); }
  return NextResponse.json({ ok: true, resetLink, deliveryStatus: "NOT_SENT" }, { headers: { "cache-control": "no-store" } });
}
