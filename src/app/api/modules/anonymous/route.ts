import { anonymousCommand, anonymousCreate, anonymousFailure, anonymousHeaders, anonymousOptions, anonymousRead } from "@/lib/modules/anonymous";
export const dynamic="force-dynamic";
export async function GET() {try{return Response.json(await anonymousOptions(),{headers:anonymousHeaders});}catch(e){return anonymousFailure(e);}}
export async function POST(req:Request) {
 try {
  const input=await req.json();
  const result=input.action==="CREATE"?await anonymousCreate(input):input.action==="READ"?await anonymousRead(input.key):await anonymousCommand(input);
  return Response.json(result,{headers:anonymousHeaders});
 }catch(e){return anonymousFailure(e);}
}
