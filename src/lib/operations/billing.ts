import { createHash } from "node:crypto";
import { z } from "zod";
import type { ReportRow } from "./reports";

const ruleSchema=z.object({
 version:z.string().min(1).max(80),contractReference:z.string().min(1).max(200),
 validFrom:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),validTo:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
 monthlyFixedCents:z.number().int().nonnegative().max(1000000000),
 items:z.array(z.object({indicator:z.enum(['volume','moves','bytes','tickets']),unitPriceCents:z.number().int().nonnegative().max(1000000),unitsPerCharge:z.number().positive().finite()})).max(4)
}).strict().refine(r=>r.validFrom<=r.validTo&&new Set(r.items.map(i=>i.indicator)).size===r.items.length,'Vigência ou itens duplicados inválidos');

/** Explicit contract parameters, never an inferred tariff from the bidding reference. */
export function billingRows(period:string,rows:ReportRow[]):ReportRow[]{
 const raw=process.env.OPERATIONS_BILLING_RULE_JSON;
 if(!raw)return [{id:'billing-unconfigured',category:'Faturamento',indicator:'Cálculo indisponível: regra contratual não configurada',value:0,unit:'regra ausente',source:'OPERATIONS_BILLING_RULE_JSON ausente; zero não representa gratuidade nem valor faturado'}];
 const rule=ruleSchema.parse(JSON.parse(raw));
 if(period<rule.validFrom||period>rule.validTo)throw new Error('Regra de faturamento fora da vigência da competência.');
 const hash=createHash('sha256').update(JSON.stringify(rule)).digest('hex');
 const source=`Regra ${JSON.stringify(rule)}; SHA256 ${hash}; arredondamento por item ao centavo; estimativa para conferência, não nota fiscal`;
 const result:ReportRow[]=[{id:'billing-fixed',category:'Faturamento',indicator:'Parcela mensal configurada',value:rule.monthlyFixedCents/100,unit:'BRL',source}];
 let cents=rule.monthlyFixedCents;
 for(const item of rule.items){const metric=rows.find(r=>r.id===item.indicator);if(!metric||metric.value<0||!Number.isFinite(metric.value))throw new Error('Métrica contratual indisponível.');
 const amount=Math.round(metric.value/item.unitsPerCharge*item.unitPriceCents);if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(cents+amount))throw new Error('Valor contratual excede precisão monetária.');cents+=amount;
 result.push({id:`billing-${item.indicator}`,category:'Faturamento',indicator:`Parcela variável: ${metric.indicator}`,value:amount/100,unit:'BRL',source:`${metric.value} ${metric.unit} ÷ ${item.unitsPerCharge} × ${item.unitPriceCents} centavos; ${source}`});}
 result.push({id:'billing-total',category:'Faturamento',indicator:'Total calculado para conferência contratual',value:cents/100,unit:'BRL',source});return result;
}
