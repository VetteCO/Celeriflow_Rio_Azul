import {context,failure} from "@/lib/modules/server";
import {saveSegment} from "@/lib/modules/contacts";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await saveSegment(await req.json(),await context(req,"doc:edit"),(await params).id));}catch(e){return failure(e);}}
