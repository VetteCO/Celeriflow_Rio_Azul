import {profiles} from "@/lib/modules/contacts";
import {failure} from "@/lib/modules/server";
export const dynamic="force-dynamic";
export async function GET(){try{return Response.json((await profiles()).filter(p=>p.active).map(p=>({...p,definition:{...p.definition,fields:p.definition.fields.filter(f=>f.channel!=="INTERNO")}})),{headers:{"cache-control":"no-store"}});}catch(e){return failure(e);}}
