import { listCatalog, saveCatalog } from "@/lib/modules/diary-catalog";
import { context, failure } from "@/lib/modules/server";
export const dynamic="force-dynamic";
export async function GET(req:Request) { try { await context(req); return Response.json({nodes:await listCatalog()}); } catch(e) { return failure(e); } }
export async function PUT(req:Request) { try { return Response.json(await saveCatalog(await req.json(),await context(req,"doc:edit"))); } catch(e) { return failure(e); } }
