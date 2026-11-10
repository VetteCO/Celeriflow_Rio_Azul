import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUser, userRole, role, auditLog, userAdminDepartment } from "@/db/schema";
import { requestContext } from "@/lib/profile-validation";
import { getSession, requirePerm } from "@/lib/auth";
import { setRoleClaim } from "@/lib/firebase-admin";
import { PERMS, type Role } from "@/lib/rbac";
import { canManageUser, assignableRoles, administrationLock, administrationGuard, isAdministrationConflict } from "@/lib/user-administration";
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const check = requirePerm(await getSession(req), "admin:users");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.role !== "string" || !(b.role in PERMS) || b.firebaseUid !== undefined) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const [user] = await db.select().from(appUser).where(eq(appUser.id, params.id));
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await canManageUser(check.session, user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!assignableRoles(check.session).includes(b.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (user.id === check.session.userId) return NextResponse.json({ error: "self_role_change_forbidden" }, { status: 409 });
  const [target] = await db.select().from(role).where(eq(role.name, b.role));
  if (!target) return NextResponse.json({ error: "migration_required" }, { status: 503 });
  if (b.role === "ADMIN_LOCAL" && !(await db.select().from(userAdminDepartment).where(eq(userAdminDepartment.userId, user.id))).length) return NextResponse.json({ error: "administrative_department_required" }, { status: 400 });
  const prior = await db.select({ name: role.name }).from(userRole).innerJoin(role, eq(role.id, userRole.roleId)).where(eq(userRole.userId, user.id));
  try { await db.batch([administrationLock(), administrationGuard(check.session.userId, user.id, [], b.role), db.delete(userRole).where(eq(userRole.userId, user.id)), db.insert(userRole).values({ userId: user.id, roleId: target.id }), db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "USER_ROLE_CHANGED", entityType: "app_user", entityId: user.id, metadata: { before: prior.map(r => r.name), role: b.role, ...requestContext(req) } })]); }
  catch (error) { if (isAdministrationConflict(error)) return NextResponse.json({ error: "authorization_changed" }, { status: 409 }); throw error; }
  let claimSynced = false;
  if (user.firebaseUid) try { await setRoleClaim(user.firebaseUid, b.role as Role); claimSynced = true; } catch { /* Database authorization is already effective. */ }
  return NextResponse.json({ ok: true, claimSynced });
}
