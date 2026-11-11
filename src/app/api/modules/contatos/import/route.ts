import { z } from "zod";
import { context, failure, getRecord, ModuleError } from "@/lib/modules/server";
import { saveContact } from "@/lib/modules/contacts";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const ctx = await context(req, "doc:create");
    const batch=z.object({profileId:z.string().uuid(),profileRevision:z.number().int().positive(),rows:z.array(z.object({ title: z.string().min(3).max(250), values: z.record(z.string(),z.string().max(5000)), idempotencyKey: z.string().uuid() })).min(1).max(100)}).parse(await req.json());
    const rows=batch.rows;
    const results = [];
    for (let index = 0; index < rows.length; index++) {
      const input = rows[index];
      try { const saved=await saveContact({...input,profileId:batch.profileId,profileRevision:batch.profileRevision},ctx);const record=await getRecord(String(saved.id),ctx); results.push({ row: index + 2, id: record.id, code: record.code, error: null }); }
      catch (error) { results.push({ row: index + 2, id: null, code: null, error: error instanceof ModuleError ? error.message : "Linha não importada: confira duplicidade, campos e revisão do perfil." }); }
    }
    return Response.json({ results });
  } catch (e) { return failure(e); }
}
