import {context,failure} from "@/lib/modules/server";
import {segments,saveSegment} from "@/lib/modules/contacts";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{return Response.json(await segments(await context(req)),{headers:{"cache-control":"private, no-store"}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{return Response.json(await saveSegment(await req.json(),await context(req,"doc:edit")),{status:201});}catch(e){return failure(e);}}
