import { db } from "@/db";
import { role, userRole, department, userDepartment, userAdminDepartment } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { Session } from "./auth";
// Every role/scope mutation shares this transaction lock. The following guard is
// a separate statement so READ COMMITTED sees changes made while waiting.
export const administrationLock = () => db.execute(sql`SELECT pg_advisory_xact_lock(20261110, 41)`);
export function administrationGuard(actorId: string, targetId: string, destinationIds: string[] = [], newRole: string | null = null, globalOnly = false, creating = false) {
  return db.execute(sql`WITH RECURSIVE actor_roles AS (
    SELECT r.name FROM app_user a JOIN user_role ur ON ur.user_id=a.id JOIN role r ON r.id=ur.role_id WHERE a.id=${actorId}::uuid AND a.active
  ), scope(id) AS (
    SELECT d.id FROM department d WHERE d.active AND (
      (EXISTS(SELECT 1 FROM actor_roles WHERE name='ADMIN_LOCAL') AND d.id IN(SELECT department_id FROM user_admin_department WHERE user_id=${actorId}::uuid))
      OR (NOT EXISTS(SELECT 1 FROM actor_roles WHERE name='ADMIN_LOCAL') AND (d.id=(SELECT department_id FROM app_user WHERE id=${actorId}::uuid) OR d.id IN(SELECT department_id FROM user_department WHERE user_id=${actorId}::uuid))))
    UNION SELECT d.id FROM department d JOIN scope s ON d.parent_id=s.id WHERE d.active
  ), allowed(name) AS (
    SELECT unnest(CASE WHEN EXISTS(SELECT 1 FROM actor_roles WHERE name='ADMIN_LOCAL') THEN ARRAY['NIVEL_1','NIVEL_2','NIVEL_3_VISUALIZACAO'] ELSE ARRAY['NIVEL_2','NIVEL_3_VISUALIZACAO'] END)
  ), authorized AS (
    SELECT 1 FROM app_user target WHERE target.id=${targetId}::uuid AND (
      EXISTS(SELECT 1 FROM actor_roles WHERE name='ADMIN_GERAL') OR (
        NOT ${globalOnly} AND EXISTS(SELECT 1 FROM actor_roles WHERE name IN('ADMIN_LOCAL','NIVEL_1'))
        AND (${creating} OR target.department_id IN(SELECT id FROM scope))
        AND (${creating} OR NOT EXISTS(SELECT 1 FROM user_department ud WHERE ud.user_id=target.id AND ud.department_id NOT IN(SELECT id FROM scope)))
        AND (${creating} OR NOT EXISTS(SELECT 1 FROM user_role ur JOIN role r ON r.id=ur.role_id WHERE ur.user_id=target.id AND r.name NOT IN(SELECT name FROM allowed)))
        AND (${newRole}::text IS NULL OR ${newRole}::text IN(SELECT name FROM allowed))
        AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(${JSON.stringify(destinationIds)}::jsonb) x WHERE x.value::uuid NOT IN(SELECT id FROM scope))
      )
    ) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(${JSON.stringify(destinationIds)}::jsonb) x WHERE NOT EXISTS(SELECT 1 FROM department d WHERE d.id=x.value::uuid AND d.active))
  ) SELECT 1 / (SELECT count(*)::int FROM authorized) AS authorized`);
}
export function isAdministrationConflict(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.code === "22012" || e.cause?.code === "22012";
}
export function assignableRoles(session: Session): string[] {
  if (session.roles.includes("ADMIN_GERAL")) return ["ADMIN_GERAL", "ADMIN_LOCAL", "NIVEL_1", "NIVEL_2", "NIVEL_3_VISUALIZACAO", "AUDITOR"];
  if (session.roles.includes("ADMIN_LOCAL")) return ["NIVEL_1", "NIVEL_2", "NIVEL_3_VISUALIZACAO"];
  if (session.roles.includes("NIVEL_1")) return ["NIVEL_2", "NIVEL_3_VISUALIZACAO"];
  return [];
}
// Administrative subtree only: this does not expand document-reading membership.
export async function managedDepartmentIds(session: Session): Promise<string[]> {
  const rows = await db.select().from(department);
  if (session.roles.includes("ADMIN_GERAL")) return rows.map(d => d.id);
  if (!session.roles.some(r => r === "ADMIN_LOCAL" || r === "NIVEL_1")) return [];
  const grants = session.roles.includes("ADMIN_LOCAL") ? await db.select().from(userAdminDepartment).where(eq(userAdminDepartment.userId, session.userId)) : [];
  const roots = session.roles.includes("ADMIN_LOCAL") ? grants.map(grant => grant.departmentId) : session.departmentIds;
  const ids = new Set(roots.filter(id => rows.some(d => d.id === id && d.active)));
  let changed = true;
  while (changed) { changed = false; for (const d of rows) if (d.active && d.parentId && ids.has(d.parentId) && !ids.has(d.id)) { ids.add(d.id); changed = true; } }
  return Array.from(ids);
}
export async function canManageUser(session: Session, target: { id: string; departmentId: string | null }) {
  if (session.roles.includes("ADMIN_GERAL")) return true;
  const managed = await managedDepartmentIds(session);
  if (!target.departmentId || !managed.includes(target.departmentId)) return false;
  const secondary = await db.select().from(userDepartment).where(eq(userDepartment.userId, target.id));
  if (secondary.some(s => !managed.includes(s.departmentId))) return false;
  const roles = await db.select({ name: role.name }).from(userRole).innerJoin(role, eq(userRole.roleId, role.id)).where(eq(userRole.userId, target.id));
  return roles.every(r => assignableRoles(session).includes(r.name));
}
