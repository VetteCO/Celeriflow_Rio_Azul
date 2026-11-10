import { verifyIdToken } from "@/lib/firebase-admin";
import { can, PERMS, type Role } from "@/lib/rbac";
import { db } from "@/db";
import { appUser, role, userRole, userDepartment, document, documentParticipation, documentRecipient, department } from "@/db/schema";
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
    const [links, sectors] = await Promise.all([
      db.select({ name: role.name }).from(userRole).innerJoin(role, eq(role.id, userRole.roleId)).where(eq(userRole.userId, user.id)),
      db.select().from(userDepartment).where(eq(userDepartment.userId, user.id)),
    ]);
    const priority = Object.keys(PERMS);
    const roles = Array.from(new Set(links.map(r => r.name).filter((r): r is Role => Object.prototype.hasOwnProperty.call(PERMS, r)))).sort((a, b) => priority.indexOf(a) - priority.indexOf(b));
    await db.execute(sql`WITH accessed AS (
      INSERT INTO user_profile(user_id,last_access_at) VALUES(${user.id}::uuid,now())
      ON CONFLICT(user_id) DO UPDATE SET last_access_at=now() WHERE user_profile.last_access_at IS NULL OR user_profile.last_access_at < now()-interval '15 minutes' RETURNING user_id
    ) INSERT INTO audit_log(actor_type,actor_id,action,entity_type,entity_id,metadata)
      SELECT 'USER',${user.id},'SESSION_ACCESSED','app_user',${user.id},jsonb_build_object('ip',${req.headers.get("x-forwarded-for")}::text,'userAgent',${req.headers.get("user-agent")}::text) FROM accessed`);
    return { uid: user.firebaseUid!, userId: user.id, email: user.email, role: roles[0], roles, departmentId: user.departmentId, departmentIds: Array.from(new Set([user.departmentId, ...sectors.map(s => s.departmentId)].filter((x): x is string => !!x))) };
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
  return or(eq(document.createdById, session.userId),
    sql`exists (select 1 from document_recipient r where r.document_id = ${document.id} and r.user_id = ${session.userId} and r.recipient_type <> 'CANCELLED')`,
    sectors.length ? and(sql`${document.type} <> 'CIRCULAR'`, or(inArray(document.originDepartmentId, sectors), sql`exists (select 1 from document_participation p where p.document_id = ${document.id} and p.department_id in (${sql.join(sectors.map(s => sql`${s}::uuid`), sql`, `)}))`)) : sql`false`);
}
export async function canAccessDocument(session: Session, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [doc] = await db.select().from(document).where(and(eq(document.id, id), documentScope(session)));
  return doc ?? null;
}
export async function isRecipient(session: Session, id: string) {
  return !!(await db.select().from(documentRecipient).where(and(eq(documentRecipient.documentId, id), eq(documentRecipient.userId, session.userId), sql`${documentRecipient.recipientType} <> 'CANCELLED'`)).limit(1))[0];
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
