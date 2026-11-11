import { and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { moduleRecord } from "@/db/modules-schema";
import { requirePerm } from "@/lib/auth";
import { context, command, detail, failure, scope } from "@/lib/modules/server";
import { signatureFamilies, signatureStates, signersSchema } from "@/lib/modules/signatures";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const ctx = await context(req);
    const records = await db.select().from(moduleRecord).where(and(scope(ctx), inArray(moduleRecord.family, signatureFamilies))).orderBy(desc(moduleRecord.updatedAt));
    return Response.json({ records: records.filter(r => r.data.signatures?.length || signatureStates.includes(r.status)).map(r => ({ id: r.id, code: r.code, title: r.title, revision: r.revision, status: r.status, signatures: r.data.signatures ?? [], requestedAt: r.data.signatureEnvelope?.requestedAt ?? "", hash: r.data.signatureEnvelope?.hash ?? "" })), writable: requirePerm(ctx.session, "doc:edit").ok });
  } catch (e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    const ctx = await context(req, "doc:edit");
    const input = z.object({ action: z.enum(["SOLICITAR_ASSINATURA", "CANCELAR_ASSINATURAS", "RECUSAR_ASSINATURA"]), records: z.array(z.object({ id: z.string().uuid(), revision: z.number().int().positive() })).min(1).max(100), signers: signersSchema.optional(), note: z.string().trim().min(3).max(1000) }).parse(await req.json());
    if (new Set(input.records.map(r => r.id)).size !== input.records.length) return Response.json({ error: "Selecione cada documento uma única vez." }, { status: 400 });
    if (input.action === "SOLICITAR_ASSINATURA") signersSchema.parse(input.signers);
    const results = [];
    for (const target of input.records) {
      try {
        const available = await detail(target.id, ctx);
        if (!available.permissions.actions.includes(input.action)) { results.push({ id: target.id, saved: false, error: "Ação indisponível para sua conta ou situação do documento." }); continue; }
        const record = await command(target.id, { revision: target.revision, action: input.action, payload: { signers: input.signers }, note: input.note }, ctx);
        results.push({ id: target.id, saved: true, revision: record.revision });
      } catch (e) {
        const response = failure(e); const data = await response.json();
        results.push({ id: target.id, saved: false, error: data.error });
      }
    }
    return Response.json({ results });
  } catch (e) { return failure(e); }
}
