import test from 'node:test';
import assert from 'node:assert/strict';
import { billingRows } from './billing';
const row={id:'moves',category:'Produtividade',indicator:'Movimentos',value:3,unit:'eventos',source:'fixture'};
function configured(rule:unknown,work:()=>void){const original=process.env.OPERATIONS_BILLING_RULE_JSON;try{if(rule===undefined)delete process.env.OPERATIONS_BILLING_RULE_JSON;else process.env.OPERATIONS_BILLING_RULE_JSON=JSON.stringify(rule);work();}finally{if(original===undefined)delete process.env.OPERATIONS_BILLING_RULE_JSON;else process.env.OPERATIONS_BILLING_RULE_JSON=original;}}
const base={version:'teste',contractReference:'fixture',validFrom:'2026-01',validTo:'2026-12',monthlyFixedCents:100,items:[{indicator:'moves',unitPriceCents:1,unitsPerCharge:2}]};
test('sem regra é ausência explícita, não total faturado',()=>configured(undefined,()=>{const rows=billingRows('2026-11',[row]);assert.equal(rows[0].unit,'regra ausente');assert.ok(!rows.some(r=>r.id==='billing-total'));}));
test('arredondamento por parcela e regra preservada na fonte',()=>configured(base,()=>{const rows=billingRows('2026-11',[row]);assert.equal(rows.find(r=>r.id==='billing-moves')?.value,.02);assert.equal(rows.find(r=>r.id==='billing-total')?.value,1.02);assert.match(rows[0].source,/SHA256 [a-f0-9]{64}/);assert.match(rows[0].source,/fixture/);}));
test('vigência inválida, itens duplicados e métrica ausente recusados',()=>{configured(base,()=>{assert.throws(()=>billingRows('2027-01',[row]));assert.throws(()=>billingRows('2026-11',[]));});configured({...base,items:[base.items[0],base.items[0]]},()=>assert.throws(()=>billingRows('2026-11',[row])));});
