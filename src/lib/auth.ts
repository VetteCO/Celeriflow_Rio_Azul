import { verifyIdToken } from "@/lib/firebase-admin";
import { can, PERMS, type Role } from "@/lib/rbac";
import { db } from "@/db";
import { appUser, role, userRole, userDepartment, document, documentParticipation, documentRecipient, department, userProfile } from "@/db/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";

export type Session = { uid: string; userId: string; role?: Role; roles: Role[]; email?: string; departmentId: string | null; departmentIds: string[] };
export async function getSession(req: Request): Promise<Session | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await verifyIdToken(token);
    const [user] = await db.select().from(appUser).where(and(eq(appUser.firebaseUid, decoded.uid), eq(appUser.active, true)));
    if (!user) return null;
    // Only Firebase's verified token can synchronize a self-service email change.
    if (decoded.email_verified && decoded.email && decoded.email.toLowerCase() !== user.email.toLowerCase()) {
      await db.execute(sql`WITH updated AS (UPDATE app_user SET email=${decoded.email.toLowerCase()} WHERE id=${user.id}::uuid RETURNING id)
        INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
        SELECT 'USER',${user.id},'USER_EMAIL_CONFIRMED','app_user',id::text,jsonb_build_object('before',${user.email}::text,'after',${decoded.email.toLowerCase()}::text) FROM updated`);
      user.email = decoded.email.toLowerCase();
    }
    const [links, sectors, departments, profiles] = await Promise.all([
      db.select({ name: role.name }).from(userRole).innerJoin(role, eq(role.id, userRole.roleId)).where(eq(userRole.userId, user.id)),
      db.select().from(userDepartment).where(eq(userDepartment.userId, user.id)),
      db.select().from(department).where(eq(department.active, true)),
      db.select().from(userProfile).where(eq(userProfile.userId, user.id)),
    ]);
    const priority = Object.keys(PERMS);
    const roles = Array.from(new Set(links.map(r => r.name).filter((r): r is Role => Object.prototype.hasOwnProperty.call(PERMS, r)))).sort((a, b) => priority.indexOf(a) - priority.indexOf(b));
    const days = profiles[0]?.details?.inactivityDays ?? 90;
    const last = profiles[0]?.lastAccessAt;
    if (last && Date.now() - last.getTime() > days * 86400000) {
      await db.execute(sql`WITH suspended AS (UPDATE app_user SET active=false WHERE id=${user.id}::uuid AND active RETURNING id)
        INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
        SELECT 'SYSTEM',null,'USER_INACTIVITY_SUSPENDED','app_user',id::text,jsonb_build_object('days',${days}::int) FROM suspended`);
      return null;
    }
    const ids = new Set([user.departmentId, ...sectors.map(s => s.departmentId)].filter((id): id is string => !!id && departments.some(d => d.id === id)));
    if (roles.includes("AUDITOR")) departments.forEach(d => ids.add(d.id));
    else if (roles.includes("NIVEL_1")) {
      let changed = true;
      while (changed) { changed = false; for (const d of departments) if (d.parentId && ids.has(d.parentId) && !ids.has(d.id)) { ids.add(d.id); changed = true; } }
    }
    await db.execute(sql`WITH accessed AS (
      INSERT INTO user_profile(user_id,last_access_at) VALUES(${user.id}::uuid,now())
      ON CONFLICT(user_id) DO UPDATE SET last_access_at=now() WHERE user_profile.last_access_at IS NULL OR user_profile.last_access_at < now()-interval '1 minute' RETURNING user_id
    ) INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
      SELECT 'USER',${user.id},'SESSION_ACCESSED','app_user',${user.id},jsonb_build_object('ip',${req.headers.get("x-forwarded-for")}::text,'userAgent',${req.headers.get("user-agent")}::text,'applicationVersion',${process.env.VERCEL_GIT_COMMIT_SHA ?? "local-0.1.0"}::text) FROM accessed`);
    return { uid: user.firebaseUid!, userId: user.id, email: user.email, role: roles[0], roles, departmentId: user.departmentId, departmentIds: Array.from(ids) };
  } catch { return null; }
}
export function requirePerm(session: Session | null, action: string): { ok: true; session: Session } | { ok: false; status: 401 | 403 } {
  if (!session) return { ok: false, status: 401 };
  if (!session.roles.some(r => can(r, action))) return { ok: false, status: 403 };
  return { ok: true, session };
}
// Global user administration does not confer global document access. Auditor is explicit.
export function documentScope(session: Session) {
  if (session.roles.includes("AUDITOR")) return sql`true`;
  const sectors = session.departmentIds;
  return or(
    sectors.length ? and(eq(document.type, "CIRCULAR"), inArray(document.originDepartmentId, sectors)) : sql`false`,
    sectors.length ? and(eq(document.createdById, session.userId), inArray(document.originDepartmentId, sectors)) : sql`false`,
    sectors.length ? sql`exists (select 1 from document_recipient r where r.document_id = ${document.id} and r.user_id = ${session.userId} and r.recipient_type <> 'CANCELLED' and r.department_id in (${sql.join(sectors.map(s => sql`${s}::uuid`), sql`, `)}))` : sql`false`,
    sectors.length ? and(sql`${document.type} <> 'CIRCULAR'`, or(inArray(document.originDepartmentId, sectors), sql`exists (select 1 from document_participation p where p.document_id = ${document.id} and p.department_id in (${sql.join(sectors.map(s => sql`${s}::uuid`), sql`, `)}))`)) : sql`false`);
}
export async function canAccessDocument(session: Session, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [doc] = await db.select().from(document).where(and(eq(document.id, id), documentScope(session)));
  return doc ?? null;
}
export async function isRecipient(session: Session, id: string) {
  return !!session.departmentIds.length && !!(await db.select().from(documentRecipient).where(and(eq(documentRecipient.documentId, id), eq(documentRecipient.userId, session.userId), inArray(documentRecipient.departmentId, session.departmentIds), sql`${documentRecipient.recipientType} <> 'CANCELLED'`)).limit(1))[0];
}
export async function canActInDepartment(session: Session, documentId: string, departmentId: string) {
  if (!session.departmentIds.includes(departmentId)) return false;
  return !!(await db.select({ id: documentParticipation.documentId }).from(documentParticipation).innerJoin(department, eq(department.id, documentParticipation.departmentId)).where(and(eq(documentParticipation.documentId, documentId), eq(documentParticipation.departmentId, departmentId), eq(department.active, true), inArray(documentParticipation.state, ["OPEN", "PENDING"])))).length;
}

export async function canActInAnyDepartment(session: Session, documentId: string) {
  if (!session.departmentIds.length) return false;
  return !!(await db.select({ id: documentParticipation.documentId }).from(documentParticipation)
    .innerJoin(department, eq(department.id, documentParticipation.departmentId))
    .where(and(eq(documentParticipation.documentId, documentId), inArray(documentParticipation.departmentId, session.departmentIds), eq(department.active, true), inArray(documentParticipation.state, ["OPEN", "PENDING"]))).limit(1))[0];
}
