import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionMatches, fieldSchema, validCalendarDate, validateFields, validateWorkflowFields, workflowSchema } from "./domain";

const step = { name: "Análise", departments: ["11111111-1111-4111-8111-111111111111"], hours: 24 };

test("datas civis recusam normalização silenciosa e respeitam anos bissextos", () => {
  for (const date of ["2026-02-29", "2026-04-31", "1900-02-29", "0000-01-01", "2026-13-01", "2026-00-01", "2026-1-01"]) {
    assert.equal(validCalendarDate(date), false, date);
    assert.throws(() => validateFields([{ key: "prazo", label: "Prazo", type: "date" }], { prazo: date }), /data inválida/);
  }
  for (const date of ["2000-02-29", "2024-02-29", "2026-12-31", "0099-01-01"]) assert.equal(validCalendarDate(date), true, date);
});

test("falha posterior ao cálculo mantém os valores originais", () => {
  const workflow = workflowSchema.parse({ family: "processos", steps: [step], fields: [
    { key: "total", label: "Total", type: "number", calculation: { operation: "sum", fields: ["a", "b"], decimals: 2 } },
    { key: "prazo", label: "Prazo", type: "date", required: true },
  ] });
  const values = { a: "2", b: "3", total: "999", prazo: "2026-02-30" };
  assert.throws(() => validateWorkflowFields(workflow, values), /data inválida/);
  assert.equal(values.total, "999");
  values.prazo = "2026-02-28";
  validateWorkflowFields(workflow, values);
  assert.equal(values.total, "5.00");
});

test("campos duplicados não permitem contornar um cálculo ou obrigatoriedade", () => {
  const input = { family: "processos", steps: [step], fields: [
    { key: "total", label: "Total", type: "number" },
    { key: "total", label: "Outro total", type: "text" },
  ] };
  assert.throws(() => workflowSchema.parse(input), /duplicadas/);
});

test("configuração recusa limites invertidos e seleções sem opções únicas", () => {
  for (const field of [
    { key: "a", label: "A", type: "text", minLength: 10, maxLength: 2 },
    { key: "a", label: "A", type: "radio", options: [] },
    { key: "a", label: "A", type: "checkbox", options: ["A", "A"] },
    { key: "a", label: "A", type: "select", options: [" "] },
  ]) assert.equal(workflowSchema.safeParse({ family: "processos", steps: [step], fields: [field] }).success, false);
});

test("seleção múltipla valida obrigatoriedade, opções e condicionais sem coincidência parcial", () => {
  const field = fieldSchema.parse({ key: "opcoes", label: "Opções", type: "checkbox", required: true, options: ["Obra", "Obra pública"] });
  for (const value of ["", "[]", "[1]", '["Outra"]', '["Obra","Obra"]', "Obra"]) assert.throws(() => validateFields([field], { opcoes: value }));
  assert.doesNotThrow(() => validateFields([field], { opcoes: '["Obra","Obra pública"]' }));
  const conditional = fieldSchema.parse({ key: "detalhe", label: "Detalhe", type: "text", condition: { field: "opcoes", operator: "contains", equals: "Obra" } });
  assert.equal(conditionMatches(conditional, { opcoes: '["Obra pública"]' }), false);
  assert.equal(conditionMatches(conditional, { opcoes: '["Obra"]' }), true);
});

test("limites textuais, escolha única e inteiros são validados no servidor", () => {
  const text = fieldSchema.parse({ key: "motivo", label: "Motivo", type: "textarea", minLength: 3, maxLength: 5 });
  for (const value of ["ab", "abcdef"]) assert.throws(() => validateFields([text], { motivo: value }));
  assert.doesNotThrow(() => validateFields([text], { motivo: "abcde" }));
  const radio = fieldSchema.parse({ key: "escolha", label: "Escolha", type: "radio", options: ["Sim", "Não"] });
  assert.throws(() => validateFields([radio], { escolha: "Talvez" }));
  const integer = fieldSchema.parse({ key: "quantidade", label: "Quantidade", type: "integer" });
  for (const value of ["1.5", "Infinity", "9007199254740992"]) assert.throws(() => validateFields([integer], { quantidade: value }));
  assert.doesNotThrow(() => validateFields([integer], { quantidade: "12" }));
});
