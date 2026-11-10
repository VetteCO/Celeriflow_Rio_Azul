import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { context, failure, getRecord, ModuleError, redacted } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const ctx = await context(req, "doc:create");
    const input = z.object({ delegationId: z.string().uuid(), revision: z.number().int().positive() }).parse(await req.json());
    const record = await getRecord(params.id, ctx);
    const grant = await getRecord(input.delegationId, ctx);
    if (record.family === "delegacoes" || record.ownerId !== ctx.user.id || record.status !== "RASCUNHO" || record.data.values?.autorizador) throw new ModuleError("A delegação só pode ser aplicada uma vez ao seu rascunho.");
    if (grant.family !== "delegacoes" || grant.status !== "ATIVO" || grant.data.values?.digitador !== ctx.user.id) throw new ModuleError("Delegação não autorizada para este digitador.", 403);
    // Lock target first, then consume the grant and annotate the target in one statement.
    // Repetition, expiration and exhausted limits never consume another use.
    const result = await db.execute(sql`WITH target AS MATERIALIZED (
      SELECT id FROM module_record WHERE id=${record.id}::uuid AND revision=${input.revision} AND status='RASCUNHO'
      AND NOT (data->'values' ? 'autorizador') FOR UPDATE
    ), consumed AS (
      UPDATE module_record SET revision=revision+1,actor_id=${ctx.user.id}::uuid,action='DELEGACAO_UTILIZADA',note=${record.code},
      data=jsonb_set(data,'{values,usos}',to_jsonb(((data->'values'->>'usos')::integer+1)::text))
      WHERE id=${grant.id}::uuid AND status='ATIVO' AND data->'values'->>'digitador'=${ctx.user.id}
      AND (data->'values'->>'usos')::integer < (data->'values'->>'limite')::integer
      AND (data->'values'->>'validade')::date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND EXISTS(SELECT 1 FROM target) RETURNING owner_id
    ) UPDATE module_record SET revision=revision+1,actor_id=${ctx.user.id}::uuid,action='EMITIDO_POR_DELEGACAO',note=${grant.code},
      data=jsonb_set(data,'{values}',coalesce(data->'values','{}'::jsonb) || jsonb_build_object('autorizador',(SELECT owner_id::text FROM consumed),'digitador',${ctx.user.id}::text,'delegacao',${grant.id}::text))
      WHERE id IN (SELECT id FROM target) AND EXISTS(SELECT 1 FROM consumed) RETURNING id`);
    if (!result.rows.length) throw new ModuleError("Delegação vencida, esgotada ou registro alterado. Recarregue.", 409);
    return Response.json({ record: redacted(await getRecord(record.id, ctx), ctx) });
  } catch (e) { return failure(e); }
}
