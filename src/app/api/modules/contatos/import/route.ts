import { z } from "zod";
import { context, createRecord, failure } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const ctx = await context(req, "doc:create");
    const rows = z.array(z.object({ title: z.string().min(3).max(250), values: z.record(z.string().max(20000)), idempotencyKey: z.string().uuid() })).min(1).max(100).parse(await req.json());
    const results = [];
    for (let index = 0; index < rows.length; index++) {
      const input = rows[index];
      try { const record = await createRecord("contatos", input, ctx); results.push({ row: index + 2, id: record.id, code: record.code, error: null }); }
      catch (error) { results.push({ row: index + 2, id: null, code: null, error: error instanceof Error ? error.message : "Falha ao importar." }); }
    }
    return Response.json({ results });
  } catch (e) { return failure(e); }
}
