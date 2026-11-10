import {context,failure} from "@/lib/modules/server";
import {listContacts,saveContact} from "@/lib/modules/contacts";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{const ctx=await context(req);const q=new URL(req.url).searchParams;return Response.json(await listContacts(ctx,{segment:q.get("segment")??undefined,profile:q.get("profile")??undefined,type:q.get("type")??undefined}),{headers:{"cache-control":"private, no-store"}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{return Response.json(await saveContact(await req.json(),await context(req,"doc:create")),{status:201});}catch(e){return failure(e);}}
