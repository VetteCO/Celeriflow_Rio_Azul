import { z } from "zod";
import { context, command, failure, getRecord, ModuleError } from "@/lib/modules/server";
import { inspectionSchema } from "@/lib/modules/territorial";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{id:string}> }) {
  try { const row = await getRecord((await params).id, await context(req)); if (row.family !== "fiscalizacao") throw new ModuleError("Fiscalização não encontrada.",404); return Response.json({ revision:row.revision, inspections:row.data.inspections ?? [] }, {headers:{"cache-control":"private, no-store"}}); } catch(e) { return failure(e); }
}
export async function POST(req: Request, { params }: { params: Promise<{id:string}> }) {
  try { const input = z.object({ revision:z.number().int().positive(), inspection:inspectionSchema }).parse(await req.json()); const record = await command((await params).id,{revision:input.revision,action:"REGISTRAR_VISTORIA",payload:input.inspection,note:"Vistoria de campo registrada com localização e evidências."},await context(req,"doc:edit")); return Response.json({record},{headers:{"cache-control":"private, no-store"}}); } catch(e) { return failure(e); }
}
