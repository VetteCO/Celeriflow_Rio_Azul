import { db } from "@/db";
import { operationReport } from "@/db/operations-schema";
import { actor,failure,download,OperationError } from "@/lib/operations/server";
import { consistentReport as report } from "@/lib/operations/consistent-report";
import { billingRows } from "@/lib/operations/billing";
import { csv,pdf,xlsx } from "@/lib/operations/formats";
import { eq,desc } from "drizzle-orm";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function POST(req:Request){try{
 const {user}=await actor(req,"operations:reports");
 const {period,requestKey}=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),requestKey:z.string().min(8).max(150)}).parse(await req.json());
 const [existing]=await db.select().from(operationReport).where(eq(operationReport.requestKey,requestKey));
 if(existing){if(existing.period!==period)throw new OperationError(409,"Chave já utilizada para outro período.");return Response.json({report:existing});}
 const [year,month]=period.split("-").map(Number);if(year<2000||year>9999)throw new OperationError(400,"Ano inválido.");
 const filters={from:`${period}-01`,to:`${period}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`};
  const rows=await report(filters);rows.push(...billingRows(period,rows));
  const snapshot={filters,rows,generatedAt:new Date().toISOString()};
 const [created]=await db.insert(operationReport).values({createdById:user.id,period,requestKey,snapshot}).onConflictDoNothing().returning();
 const [saved]=created?[created]:await db.select().from(operationReport).where(eq(operationReport.requestKey,requestKey));
 if(saved.period!==period)throw new OperationError(409,"Chave já utilizada para outro período.");
 return Response.json({report:saved},{status:created?201:200});
}catch(e){return failure(e);}}
export async function GET(req:Request){try{
 await actor(req,"operations:reports");const p=new URL(req.url).searchParams;const id=p.get("id");
 if(!id)return Response.json({reports:await db.select({id:operationReport.id,code:operationReport.code,period:operationReport.period,createdAt:operationReport.createdAt}).from(operationReport).orderBy(desc(operationReport.createdAt))});
 const [saved]=await db.select().from(operationReport).where(eq(operationReport.id,z.string().uuid().parse(id)));
 if(!saved)throw new OperationError(404,"Relatório não encontrado.");
 const matrix:(string|number)[][]=[["Relatório",saved.code],["Período",saved.period],["Gerado em",saved.snapshot.generatedAt],["Categoria","Indicador","Valor","Unidade","Fonte"],...saved.snapshot.rows.map(r=>[r.category,r.indicator,r.value,r.unit,r.source])];
 const format=p.get("format");if(format==="csv")return download(csv(matrix),"text/csv; charset=utf-8",`contratual-${saved.code}.csv`);
 if(format==="xlsx")return download(xlsx(matrix),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",`contratual-${saved.code}.xlsx`);
 if(format==="pdf")return download(pdf(matrix.map(r=>r.join(" | "))),"application/pdf",`contratual-${saved.code}.pdf`);
 return Response.json({report:saved});
}catch(e){return failure(e);}}
