import {context,failure} from "@/lib/modules/server";
import {linkLegacy} from "@/lib/modules/contacts";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await linkLegacy((await params).id,await req.json(),await context(req,"doc:edit")));}catch(e){return failure(e);}}
