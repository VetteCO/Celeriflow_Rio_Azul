import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { admin, context, getRecord, failure, ModuleError } from "@/lib/modules/server";
import { configFamilies, type Family } from "@/lib/modules/domain";
import { z } from "zod";
import { canManage } from "@/lib/modules/policy";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
 try {
  const ctx = await context(req, "doc:edit"); const row = await getRecord(params.id, ctx);
   if (configFamilies.includes(row.family as Family)) admin(ctx);
   else if (!canManage(row, ctx)) throw new ModuleError("Sem permissão de edição.",403);
   const input = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/).optional(), release: z.boolean().optional() }).parse(await req.json()); const token = input.token ?? randomBytes(32).toString("hex");
   if (!input.release && !["RASCUNHO", "ATIVO", "SUSPENSO"].includes(row.status)) throw new ModuleError("O conteúdo já foi formalizado.", 409);
  const hash = createHash("sha256").update(token).digest("hex");
  if(input.release === true) {
   await db.execute(sql`DELETE FROM module_edit_lease WHERE record_id=${row.id}::uuid AND actor_id=${ctx.user.id}::uuid AND token_hash=${hash}`);
   return Response.json({ released:true });
  }
  const result = await db.execute(sql`INSERT INTO module_edit_lease(record_id,actor_id,token_hash,expires_at)
   VALUES(${row.id}::uuid,${ctx.user.id}::uuid,${hash},now()+interval '90 seconds')
   ON CONFLICT(record_id) DO UPDATE SET actor_id=excluded.actor_id,token_hash=excluded.token_hash,expires_at=excluded.expires_at
   WHERE module_edit_lease.expires_at<=now() OR (module_edit_lease.actor_id=excluded.actor_id AND module_edit_lease.token_hash=excluded.token_hash) RETURNING expires_at`);
  if(!result.rows.length) throw new ModuleError("Outro editor reservou este documento. Aguarde a liberação.",409);
  return Response.json({ token, expiresAt:result.rows[0].expires_at });
 } catch(e) { return failure(e); }
}
