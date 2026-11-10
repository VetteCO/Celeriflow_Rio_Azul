import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID, randomBytes } from "crypto";
import { db } from "@/db";
import { appUser, userRole, role, department, auditLog, userProfile, userDepartment } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { firebaseAdminAuth, setRoleClaim } from "@/lib/firebase-admin";
import { PERMS, type Role } from "@/lib/rbac";
import { assignableRoles, managedDepartmentIds, administrationLock, administrationGuard, isAdministrationConflict } from "@/lib/user-administration";
import { cpfField, phoneField, preferencesField } from "@/lib/profile-validation";
const Schema = z.object({ name: z.string().trim().min(3).max(200), email: z.string().email().transform(s => s.toLowerCase().trim()), departmentId: z.string().uuid(), role: z.string().refine(s => Object.prototype.hasOwnProperty.call(PERMS, s)).default("NIVEL_3_VISUALIZACAO"), password: z.string().min(12).max(128).optional(), cpf: cpfField, phone: phoneField, registration: z.string().max(100).optional(), position: z.string().max(200).optional(), secondaryDepartmentIds: z.array(z.string().uuid()).max(30).default([]), preferences: preferencesField, leaveStart: z.string().datetime().nullable().optional(), leaveEnd: z.string().datetime().nullable().optional() });
export async function GET(req: Request) {
  const check = requirePerm(await getSession(req), "admin:users");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const [users, roles, links, depts, profiles, secondary, managed] = await Promise.all([db.select().from(appUser), db.select().from(role), db.select().from(userRole), db.select().from(department), db.select().from(userProfile), db.select().from(userDepartment), managedDepartmentIds(check.session)]);
  const global = check.session.roles.includes("ADMIN_GERAL");
  const allowedRoles = assignableRoles(check.session);
  const userRoles = (id: string) => links.filter(l => l.userId === id).map(l => roles.find(r => r.id === l.roleId)?.name).filter((r): r is string => !!r);
  return NextResponse.json({ users: users.filter(u => global || !!u.departmentId && managed.includes(u.departmentId) && userRoles(u.id).every(r => allowedRoles.includes(r)) && secondary.filter(s => s.userId === u.id).every(s => managed.includes(s.departmentId))).map(u => {
    const p = profiles.find(p => p.userId === u.id);
    return { id: u.id, name: u.name, email: u.email, cpf: u.cpf, phone: p?.phone ?? null, registration: p?.registration ?? null, position: p?.position ?? null, secondaryDepartmentIds: secondary.filter(s => s.userId === u.id).map(s => s.departmentId), leaveStart: p?.leaveStart ?? null, leaveEnd: p?.leaveEnd ?? null, preferences: p?.preferences ?? {}, lastAccessAt: p?.lastAccessAt ?? null, active: u.active, firebaseUid: u.firebaseUid, departmentId: u.departmentId, govbrLinked: false, roles: userRoles(u.id) };
  }), departments: depts.filter(d => global || managed.includes(d.id)), roles: allowedRoles }, { headers: { "cache-control": "no-store" } });
}
export async function POST(req: Request) {
  const check = requirePerm(await getSession(req), "admin:users");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload", issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  const managed = await managedDepartmentIds(check.session);
  if (!assignableRoles(check.session).includes(b.role) || [b.departmentId, ...b.secondaryDepartmentIds].some(id => !managed.includes(id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const activeDepartments = await db.select().from(department).where(eq(department.active, true));
  if (b.secondaryDepartmentIds.some(id => !activeDepartments.some(d => d.id === id))) return NextResponse.json({ error: "inactive_department" }, { status: 400 });
  if (b.leaveStart && b.leaveEnd && b.leaveEnd < b.leaveStart) return NextResponse.json({ error: "invalid_leave_range" }, { status: 400 });
  const [dept] = await db.select().from(department).where(eq(department.id, b.departmentId));
  if (!dept?.active) return NextResponse.json({ error: "inactive_department" }, { status: 400 });
  if ((await db.select().from(appUser).where(eq(appUser.email, b.email))).length) return NextResponse.json({ error: "email_exists" }, { status: 409 });
  const [targetRole] = await db.select().from(role).where(eq(role.name, b.role));
  if (!targetRole) return NextResponse.json({ error: "migration_required" }, { status: 503 });
  const auth = firebaseAdminAuth();
  let uid: string | undefined, persisted = false;
  const id = randomUUID();
  try {
    const firebase = await auth.createUser({ email: b.email, displayName: b.name, password: b.password ?? randomBytes(32).toString("base64url"), disabled: true });
    uid = firebase.uid;
    await setRoleClaim(uid, b.role as Role);
    const resetLink = b.password ? null : await auth.generatePasswordResetLink(b.email);
    await db.batch([
      administrationLock(),
      administrationGuard(check.session.userId, check.session.userId, [b.departmentId, ...b.secondaryDepartmentIds], b.role, false, true),
      db.insert(appUser).values({ id, name: b.name, email: b.email, cpf: b.cpf || null, firebaseUid: uid, departmentId: b.departmentId, active: false }),
      db.insert(userRole).values({ userId: id, roleId: targetRole.id }),
      db.insert(userProfile).values({ userId: id, phone: b.phone || null, registration: b.registration, position: b.position, preferences: b.preferences ?? {}, leaveStart: b.leaveStart ? new Date(b.leaveStart) : null, leaveEnd: b.leaveEnd ? new Date(b.leaveEnd) : null }),
      ...Array.from(new Set(b.secondaryDepartmentIds)).map(departmentId => db.insert(userDepartment).values({ userId: id, departmentId })),
      db.insert(auditLog).values({ actorType: "USER", actorId: check.session.userId, action: "USER_PROVISIONED", entityType: "app_user", entityId: id, metadata: { role: b.role, departmentId: b.departmentId, ip: req.headers.get("x-forwarded-for"), userAgent: req.headers.get("user-agent") } }),
    ]);
    persisted = true;
    await auth.updateUser(uid, { disabled: false });
    await db.update(appUser).set({ active: true }).where(eq(appUser.id, id));
    return NextResponse.json({ id, email: b.email, firebaseUid: uid, resetLink, credentialStatus: b.password ? "PASSWORD_DEFINED" : "RESET_LINK_GENERATED", deliveryStatus: "NOT_SENT" }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (uid && !persisted) await auth.deleteUser(uid).catch(() => undefined);
    if (uid && persisted) await auth.updateUser(uid, { disabled: true }).catch(() => undefined);
    if (isAdministrationConflict(error)) return NextResponse.json({ error: "authorization_changed" }, { status: 409 });
    const code = (error as { code?: string }).code;
    return NextResponse.json({ error: persisted ? "provisioning_pending_recovery" : code === "auth/email-already-exists" ? "firebase_email_exists" : "provisioning_failed", ...(persisted ? { id } : {}) }, { status: code === "auth/email-already-exists" ? 409 : 502 });
  }
}
