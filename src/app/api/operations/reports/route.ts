import { actor, failure, download } from "@/lib/operations/server";
import { report, reportFilters } from "@/lib/operations/reports";
import { csv,pdf,xlsx } from "@/lib/operations/formats";
import { db } from "@/db";
import { appUser,department,auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{
 const {user}=await actor(req,"operations:reports");const url=new URL(req.url);
 const today=new Date().toISOString().slice(0,10);const filters=reportFilters.parse({from:url.searchParams.get("from")||today.slice(0,8)+"01",to:url.searchParams.get("to")||today,department:url.searchParams.get("department")||undefined,user:url.searchParams.get("user")||undefined,module:url.searchParams.get("module")||undefined});
 const rows=await report(filters);const format=url.searchParams.get("format");
 if(format){const data=[["Categoria","Indicador","Valor","Unidade","Origem"],...rows.map(r=>[r.category,r.indicator,r.value,r.unit,r.source])] as (string|number)[][];
 await db.insert(auditLog).values({actorType:"USER",actorId:user.id,action:"OPERATIONS_REPORT_EXPORT",entityType:"operations_report",metadata:{filters,format}});
 if(format==="csv")return download(csv(data),"text/csv; charset=utf-8","relatorio.csv");
 if(format==="pdf")return download(pdf(["Relatório de gestão",`Período: ${filters.from} a ${filters.to}`,`Filtros: ${JSON.stringify(filters)}`,...data.map(r=>r.join(" | "))]),"application/pdf","relatorio.pdf");
 if(format==="xlsx")return download(xlsx(data),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","relatorio.xlsx");
 return Response.json({error:"Formato inválido."},{status:400});}
 const [departments,users]=await Promise.all([db.select({id:department.id,name:department.name}).from(department),db.select({id:appUser.id,name:appUser.name}).from(appUser).where(eq(appUser.active,true))]);
 return Response.json({rows,filters,departments,users,generatedAt:new Date().toISOString(),limitations:["Acessos e assiduidade refletem apenas eventos instrumentados; ausência de eventos não comprova ausência de acesso.","Módulo corresponde ao tipo documental, família dos módulos ou SUPPORT para suporte; entidades de auditoria usam seu nome técnico. Georreferenciamento conta coordenadas e feições cadastradas, sem afirmar precisão de campo.","Disponibilidade, custos dos provedores e presença funcional não são inferidos destes dados."]});
}catch(e){return failure(e);}}
