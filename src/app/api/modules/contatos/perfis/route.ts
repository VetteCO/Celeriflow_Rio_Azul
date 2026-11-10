import {context,failure} from "@/lib/modules/server";
import {profiles,saveProfile} from "@/lib/modules/contacts";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{await context(req);return Response.json(await profiles());}catch(e){return failure(e);}}
export async function POST(req:Request){try{return Response.json(await saveProfile(await req.json(),await context(req,"doc:edit")),{status:201});}catch(e){return failure(e);}}
