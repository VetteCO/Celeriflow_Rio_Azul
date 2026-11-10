import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { citizen, department, auditLog } from "@/db/schema";
import { createDocumentWithNumber } from "@/lib/numbering";
import { publicDocument } from "@/lib/public-document";
import { validCpfCnpj } from "@/lib/tax-id";
import { getCitizenSession, reserveCitizenIdentity } from "@/lib/citizen-auth";
import {registeredCitizenForRequest,citizenContactFailure} from "@/lib/citizen-contact";
const Schema = z.object({
  name: z.string().trim().min(3).max(200), cpfCnpj: z.string().transform(s => s.replace(/\D/g, "")).refine(v=>!v||validCpfCnpj(v), "CPF/CNPJ inválido"), email: z.string().email().max(200).transform(s => s.toLowerCase()),
  phone: z.string().max(30).default(""), cep: z.string().transform(s => s.replace(/\D/g, "")).pipe(z.string().refine(v=>!v||v.length===8)), street: z.string().max(300).default(""), number: z.string().max(20), complement: z.string().max(100).default(""), district: z.string().max(200).default(""), city: z.string().max(200), state: z.string().refine(v=>!v||v.length===2), requestType: z.string().min(3).max(200), description: z.string().min(10).max(10000),
});
export async function POST(req: Request) {
  // An invalid supplied credential must never silently downgrade to anonymous.
  const authenticated = req.headers.has("authorization");
  const owner = authenticated ? await getCitizenSession(req) : null;
  if (authenticated && !owner) return NextResponse.json({ error: "verified_email_required" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload", issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  if (owner && owner.email !== b.email) return NextResponse.json({ error: "session_email_mismatch" }, { status: 403 });
  const configured=await db.execute(sql`SELECT (EXISTS(SELECT 1 FROM module_contact_profile WHERE active) OR EXISTS(SELECT 1 FROM module_contact_account a JOIN citizen c ON c.id=a.citizen_id WHERE lower(c.email)=${b.email})) AS enabled`);
  const profileRequired=configured.rows[0]?.enabled===true;
  if(profileRequired&&!owner)return NextResponse.json({error:"Entre, confirme seu e-mail e complete o cadastro por perfil antes de protocolar."},{status:401});
  if(!profileRequired&&(!validCpfCnpj(b.cpfCnpj)||b.cep.length!==8||!b.city||b.state.length!==2))return NextResponse.json({error:"Confira CPF/CNPJ, CEP, cidade e UF."},{status:400});
  const target = process.env.DEFAULT_INTAKE_DEPARTMENT_ID;
  const departments = await db.select().from(department).where(eq(department.active, true));
  const intake = target ? departments.find(d => d.id === target) : departments.find(d => /protocolo/i.test(d.name));
  if (!intake) return NextResponse.json({ error: "intake_department_not_configured" }, { status: 503 });
  const { requestType, description, ...registration } = b;
  let person: typeof citizen.$inferSelect;
  try {
    person = profileRequired&&owner?await registeredCitizenForRequest(owner,b.cpfCnpj):await reserveCitizenIdentity({ ...registration, email: owner?.email ?? registration.email, id: randomUUID() });
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "22012" || e.cause?.code === "22012") return NextResponse.json({ error: "identity_confirmation_required" }, { status: 409 });
    return citizenContactFailure(error);
  }
  const doc = await createDocumentWithNumber({ type: "EXTERNAL_REQUEST", subject: requestType, body: description, originDepartmentId: intake.id, toDepartmentId: intake.id, createdById: null, accessLevel: "PUBLIC", external: { person, existing: true, requestType } });
  await db.insert(auditLog).values({ actorType: "CITIZEN", actorId: owner?.uid ?? person.id, action: "EXTERNAL_REQUEST_OWNER_RECORDED", entityType: "document", entityId: doc.id, metadata: { citizenId: person.id, authentication: owner ? "FIREBASE_VERIFIED_EMAIL" : "ANONYMOUS", firebaseUid: owner?.uid ?? null, email: owner?.email ?? person.email } });
  return NextResponse.json({ protocolNumber: doc.businessCode, publicKey: doc.publicKey, emailStatus: "PENDING", notificationStatus: "AWAITING_CHANNEL_CONFIGURATION" }, { status: 201 });
}
export async function GET(req: Request) {
  const result = await publicDocument(new URL(req.url).searchParams.get("key") ?? "");
  return NextResponse.json(result ?? { error: "not_found" }, { status: result ? 200 : 404, headers: { "cache-control": "no-store" } });
}
