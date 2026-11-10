import { verifyIdToken } from "./firebase-admin";
import { db } from "@/db";
import { citizen, citizenIdentity, externalRequest, document } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
export async function getCitizenSession(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try {
    const decoded = await verifyIdToken(token);
    if (!decoded.email || !decoded.email_verified) return null;
    return { uid: decoded.uid, email: decoded.email.toLowerCase() };
  } catch { return null; }
}
export async function ownedCitizenDocument(req: Request, key: string) {
  const session = await getCitizenSession(req);
  if (!session) return null;
  const [record] = await db.select({ doc: document, request: externalRequest }).from(externalRequest).innerJoin(citizen, eq(citizen.id, externalRequest.citizenId)).innerJoin(document, eq(document.id, externalRequest.documentId)).where(and(eq(externalRequest.publicKey, key), sql`lower(${citizen.email})=${session.email}`));
  return record ? { ...record, session } : null;
}

// Reserve a consistent registration before creating a protocol. No proof of CPF
// ownership is inferred from an anonymous e-mail. Existing registration is never returned to the caller.
export async function reserveCitizenIdentity(person: typeof citizen.$inferInsert & { id: string }) {
  const [, , , , rows] = await db.batch([
    db.execute(sql`SELECT pg_advisory_xact_lock(20261110,42)`),
    db.execute(sql`SELECT 1 / CASE WHEN
      EXISTS(SELECT 1 FROM citizen WHERE lower(email)=lower(${person.email}) AND regexp_replace(cpf_cnpj,'[^0-9]','','g')<>${person.cpfCnpj})
      OR EXISTS(SELECT 1 FROM citizen WHERE regexp_replace(cpf_cnpj,'[^0-9]','','g')=${person.cpfCnpj} AND lower(email)<>lower(${person.email}))
      THEN 0 ELSE 1 END AS identity_consistent`),
    db.execute(sql`INSERT INTO citizen(id,name,cpf_cnpj,email,phone,cep,street,number,complement,district,city,state)
      SELECT ${person.id}::uuid,${person.name},${person.cpfCnpj},${person.email},${person.phone ?? null},${person.cep ?? null},${person.street ?? null},${person.number ?? null},${person.complement ?? null},${person.district ?? null},${person.city ?? null},${person.state ?? null}
      WHERE NOT EXISTS(SELECT 1 FROM citizen_identity WHERE cpf_cnpj=${person.cpfCnpj})`),
    db.execute(sql`INSERT INTO citizen_identity(cpf_cnpj,citizen_id) SELECT ${person.cpfCnpj},${person.id}::uuid WHERE EXISTS(SELECT 1 FROM citizen WHERE id=${person.id}::uuid) ON CONFLICT DO NOTHING`),
    db.select({ person: citizen }).from(citizenIdentity).innerJoin(citizen, eq(citizen.id, citizenIdentity.citizenId)).where(eq(citizenIdentity.cpfCnpj, person.cpfCnpj)),
  ]);
  if (!rows[0]) throw new Error("identity_reservation_failed");
  return rows[0].person;
}
