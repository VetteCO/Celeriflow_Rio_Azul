import {context,failure,getRecord,ModuleError} from "@/lib/modules/server";
import {saveContact} from "@/lib/modules/contacts";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{const row=await getRecord((await params).id,await context(req));if(row.family!=="contatos")throw new ModuleError("Contato não encontrado.",404);return Response.json({id:row.id,title:row.title,revision:row.revision,status:row.status,values:row.data.values??{}},{headers:{"cache-control":"private, no-store"}});}catch(e){return failure(e);}}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await saveContact(await req.json(),await context(req,"doc:edit"),(await params).id));}catch(e){return failure(e);}}
