import {context,failure} from "@/lib/modules/server";
import {mergeContacts} from "@/lib/modules/contacts";
export async function POST(req:Request){try{return Response.json(await mergeContacts(await req.json(),await context(req,"doc:edit")));}catch(e){return failure(e);}}
