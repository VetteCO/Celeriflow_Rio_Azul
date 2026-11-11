import { z } from "zod";
import { checkUrbanLimits } from "@/lib/modules/territorial";
import { context, failure, getRecord, ModuleError } from "@/lib/modules/server";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
 try {const ctx=await context(req),project=await getRecord((await params).id,ctx);if(project.family!=="projetos")throw new ModuleError("Selecione um projeto.");const id=z.string().uuid().parse(new URL(req.url).searchParams.get("lawId")??project.data.values?.legislacaoId);const law=await getRecord(id,ctx);if(law.family!=="legislacao"||law.status!=="ATIVO")throw new ModuleError("Selecione uma legislação ativa.");return Response.json({project:{id:project.id,revision:project.revision},law:{id:law.id,revision:law.revision,title:law.title,number:law.data.values?.numero,effectiveFrom:law.data.values?.vigencia},checks:checkUrbanLimits(project.data.values??{},law.data.values??{}),notice:"Comparação numérica com a versão legal selecionada; não substitui enquadramento territorial nem decisão administrativa."},{headers:{"cache-control":"private, no-store"}});}catch(e){return failure(e);}
}
