import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PERMS, can, type Role } from "./rbac";
export { administrationLock as coreWriteLock, isAdministrationConflict as isCoreWriteConflict } from "./user-administration";

// Execute AFTER the administration lock, in the same batch as the write. This
// rechecks role, activation and physical/hierarchical membership after waiting.
export function coreWriteGuard(userId: string, permission: string, documentId: string | null, departmentId: string | null = null, openOnly = false) {
  const allowed = (Object.keys(PERMS) as Role[]).filter(role => can(role, permission));
  return db.execute(sql`WITH RECURSIVE roles AS (
    SELECT r.name FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.id=${userId}::uuid AND u.active
  ), scope(id) AS (
    SELECT d.id FROM department d WHERE d.active AND (
      EXISTS(SELECT 1 FROM roles WHERE name='AUDITOR') OR d.id=(SELECT department_id FROM app_user WHERE id=${userId}::uuid)
      OR d.id IN(SELECT department_id FROM user_department WHERE user_id=${userId}::uuid))
    UNION SELECT d.id FROM department d JOIN scope s ON d.parent_id=s.id WHERE d.active AND EXISTS(SELECT 1 FROM roles WHERE name='NIVEL_1')
  ), permitted AS (
    SELECT 1 WHERE EXISTS(SELECT 1 FROM roles WHERE name IN(${sql.join(allowed.map(role => sql`${role}`), sql`, `)}))
    AND (${departmentId}::uuid IS NULL OR ${departmentId}::uuid IN(SELECT id FROM scope))
    AND (${documentId}::uuid IS NULL OR EXISTS(SELECT 1 FROM document_participation p WHERE p.document_id=${documentId}::uuid AND p.department_id IN(SELECT id FROM scope)
      AND (${departmentId}::uuid IS NULL OR p.department_id=${departmentId}::uuid) AND (NOT ${openOnly} OR p.state IN('OPEN','PENDING'))))
    AND (${documentId}::uuid IS NULL OR EXISTS(SELECT 1 FROM document d WHERE d.id=${documentId}::uuid AND
      (d.type<>'CIRCULAR' OR EXISTS(SELECT 1 FROM roles WHERE name='AUDITOR')
       OR d.origin_department_id IN(SELECT id FROM scope)
       OR EXISTS(SELECT 1 FROM document_recipient r WHERE r.document_id=d.id AND r.user_id=${userId}::uuid AND r.recipient_type<>'CANCELLED' AND r.department_id IN(SELECT id FROM scope)))))
  ) SELECT 1/(SELECT count(*)::int FROM permitted) AS authorized`);
}
