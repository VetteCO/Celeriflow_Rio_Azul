import { organizeEdition } from "@/lib/modules/diary-catalog";
import { context, failure } from "@/lib/modules/server";
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}) { try { const {id}=await params; return Response.json(await organizeEdition(id,await req.json(),await context(req,"doc:edit"))); } catch(e) { return failure(e); } }
