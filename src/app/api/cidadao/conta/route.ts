import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { citizen, externalRequest, document } from "@/db/schema";
import { getCitizenSession } from "@/lib/citizen-auth";
import { z } from "zod";
export async function GET(req: Request) {
  const session = await getCitizenSession(req);
  if (!session) return NextResponse.json({ error: "verified_email_required" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const paging = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) }).safeParse({ page: q.get("page") ?? undefined, pageSize: q.get("pageSize") ?? undefined });
  if (!paging.success) return NextResponse.json({ error: "invalid_pagination" }, { status: 400 });
  const { page, pageSize } = paging.data;
  const where = sql`lower(${citizen.email})=${session.email} AND NOT EXISTS(SELECT 1 FROM module_contact_account WHERE citizen_id=${citizen.id} AND uid<>${session.uid})`;
  const [rows, totals] = await Promise.all([
    db.select({ protocolNumber: externalRequest.protocolNumber, publicKey: externalRequest.publicKey, subject: document.subject, status: document.status, createdAt: externalRequest.createdAt }).from(externalRequest).innerJoin(citizen, eq(citizen.id, externalRequest.citizenId)).innerJoin(document, eq(document.id, externalRequest.documentId)).where(where).orderBy(desc(externalRequest.createdAt), desc(externalRequest.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(externalRequest).innerJoin(citizen, eq(citizen.id, externalRequest.citizenId)).innerJoin(document, eq(document.id, externalRequest.documentId)).where(where),
  ]);
  return NextResponse.json({ email: session.email, requests: rows, page, pageSize, total: totals[0].count }, { headers: { "cache-control": "no-store" } });
}
