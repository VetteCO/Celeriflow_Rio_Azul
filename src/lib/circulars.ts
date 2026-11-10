import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { documentRecipient, documentReadReceipt } from "@/db/schema";
import type { Session } from "./auth";
import { coreWriteLock } from "./core-write-guard";

export function circularPopulation(recipients: (typeof documentRecipient.$inferSelect)[], receipts: (typeof documentReadReceipt.$inferSelect)[]) {
  const population = [...new Map(recipients.filter(r => r.userId && r.recipientType !== "CANCELLED").map(r => [r.userId!, r])).values()];
  const read = population.filter(r => receipts.some(rc => rc.userId === r.userId)).length;
  return { population, stats: { total: population.length, read, unread: population.length - read } };
}
export function recipientSnapshotGuard(departmentIds: string[], expected: { id: string; departmentId: string | null }[]) {
  return db.execute(sql`WITH actual AS (
    SELECT DISTINCT ON(u.id) u.id,d.id AS department_id FROM app_user u JOIN department d ON d.active AND d.id IN (${sql.join(departmentIds.map(id => sql`${id}::uuid`), sql`, `)})
    AND (u.department_id=d.id OR EXISTS(SELECT 1 FROM user_department ud WHERE ud.user_id=u.id AND ud.department_id=d.id))
    WHERE u.active ORDER BY u.id,(u.department_id=d.id) DESC,d.id
  ), expected AS (SELECT (e->>'id')::uuid AS id,(e->>'departmentId')::uuid AS department_id FROM jsonb_array_elements(${JSON.stringify(expected)}::jsonb) e), difference AS (
    (SELECT * FROM actual EXCEPT SELECT * FROM expected) UNION ALL (SELECT * FROM expected EXCEPT SELECT * FROM actual)
  ) SELECT 1/(CASE WHEN NOT EXISTS(SELECT 1 FROM difference) AND (SELECT count(*) FROM department WHERE active AND id IN (${sql.join(departmentIds.map(id => sql`${id}::uuid`), sql`, `)}))=${departmentIds.length} THEN 1 ELSE 0 END) AS recipients_current`);
}
// Re-evaluate membership after the shared administration lock and the document
// lock, serializing receipt creation with transfers and recipient edits.
export async function recordCircularRead(session: Session, id: string) {
  const [, , result] = await db.batch([coreWriteLock(), db.execute(sql`SELECT id FROM document WHERE id=${id}::uuid FOR UPDATE`), db.execute(sql`
    INSERT INTO document_read_receipt(document_id,user_id)
    SELECT d.id,u.id FROM document d JOIN app_user u ON u.id=${session.userId}::uuid AND u.active
    WHERE d.id=${id}::uuid AND d.type='CIRCULAR' AND EXISTS (
      SELECT 1 FROM document_recipient r JOIN department s ON s.id=r.department_id AND s.active
      WHERE r.document_id=d.id AND r.user_id=u.id AND r.recipient_type<>'CANCELLED' AND
      (u.department_id=r.department_id OR EXISTS(SELECT 1 FROM user_department ud WHERE ud.user_id=u.id AND ud.department_id=r.department_id)))
    ON CONFLICT(document_id,user_id) DO NOTHING RETURNING first_read_at`)]);
  const receipt = await db.execute(sql`SELECT first_read_at FROM document_read_receipt WHERE document_id=${id}::uuid AND user_id=${session.userId}::uuid
    AND EXISTS(SELECT 1 FROM document_recipient r JOIN app_user u ON u.id=r.user_id AND u.active JOIN department d ON d.id=r.department_id AND d.active
      WHERE r.document_id=${id}::uuid AND r.user_id=${session.userId}::uuid AND r.recipient_type<>'CANCELLED'
      AND (u.department_id=r.department_id OR EXISTS(SELECT 1 FROM user_department ud WHERE ud.user_id=u.id AND ud.department_id=r.department_id)))`);
  return result.rows[0]?.first_read_at ?? receipt.rows[0]?.first_read_at ?? null;
}
