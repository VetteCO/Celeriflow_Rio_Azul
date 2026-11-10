import {getCitizenSession} from "@/lib/citizen-auth";
import {citizenContactFailure,CitizenContactError,externalContactDetail,saveExternalContact} from "@/lib/citizen-contact";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{const session=await getCitizenSession(req);if(!session)throw new CitizenContactError("Entre e confirme o e-mail para acessar o cadastro.",401);return Response.json(await externalContactDetail(session),{headers:{"cache-control":"private, no-store"}});}catch(e){return citizenContactFailure(e);}}
export async function POST(req:Request){try{const session=await getCitizenSession(req);if(!session)throw new CitizenContactError("Entre e confirme o e-mail para salvar o cadastro.",401);return Response.json(await saveExternalContact(await req.json(),session),{headers:{"cache-control":"private, no-store"}});}catch(e){return citizenContactFailure(e);}}
