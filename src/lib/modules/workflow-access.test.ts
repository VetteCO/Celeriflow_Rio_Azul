import { test } from "node:test";
import assert from "node:assert/strict";
import { businessDate, fieldState, workflowSchema } from "./domain";
import { workflowValues } from "./workflow-values";

const input = (fields: unknown[]) => workflowSchema.parse({ family: "processos", fields, steps: [{ name: "Análise", hours: 24, departments: ["11111111-1111-4111-8111-111111111111"] }] });

test("regras de exibir, ocultar e obrigar são independentes; ocultar prevalece", () => {
  const workflow = input([{ key: "modo", label: "Modo", type: "text" }, { key: "motivo", label: "Motivo", type: "text", rules: [
    { action: "EXIBIR", condition: { field: "modo", equals: "Sim" } },
    { action: "OBRIGAR", condition: { field: "modo", equals: "Sim" } },
    { action: "OCULTAR", condition: { field: "modo", equals: "Não" } },
  ] }]);
  assert.deepEqual(fieldState(workflow.fields[1], { modo: "Não" }, "EXTERNO"), { visible: false, required: false, editable: false });
  assert.throws(() => workflowValues(workflow, { modo: "Sim" }, { channel: "EXTERNO" }), /Preencha Motivo/);
  assert.equal(workflowValues(workflow, { modo: "Não", motivo: "valor oculto" }, { channel: "EXTERNO" }).motivo, undefined);
  assert.equal(workflowValues(workflow, { modo: "Sim", motivo: "Justificativa" }, { channel: "EXTERNO" }).motivo, "Justificativa");
});

test("canal externo não injeta campo interno nem depende de sua obrigatoriedade", () => {
  const workflow = input([{ key: "interno", label: "Nota interna", type: "text", required: true, visibility: "INTERNO" }, { key: "resumo", label: "Resumo", type: "text", editAfterProtocol: "EXTERNO" }]);
  assert.deepEqual(workflowValues(workflow, { resumo: "Pedido" }, { channel: "EXTERNO" }), { resumo: "Pedido" });
  assert.throws(() => workflowValues(workflow, { interno: "injetado" }, { channel: "EXTERNO" }), /não autorizado/);
  const before = { interno: "Nota preservada", resumo: "Pedido" };
  const after = workflowValues(workflow, { resumo: "Complementado" }, { channel: "EXTERNO", previous: before, afterProtocol: true });
  assert.equal(after.interno, before.interno); assert.equal(before.resumo, "Pedido");
  assert.throws(() => workflowValues(workflow, { interno: "" }, { channel: "EXTERNO", previous: before, afterProtocol: true }), /protegido/);
});

test("campos bloqueados e pós-protocolo são impostos no servidor sem mutação parcial", () => {
  const workflow = input([{ key: "origem", label: "Origem", type: "text", locked: true, initialValue: "Atendimento" }, { key: "motivo", label: "Motivo", type: "text" }, { key: "complemento", label: "Complemento", type: "text", editAfterProtocol: "INTERNO" }]);
  assert.equal(workflowValues(workflow, {}, { channel: "INTERNO" }).origem, "Atendimento");
  const before = { origem: "Atendimento", motivo: "Original", complemento: "" };
  for (const submitted of [{ origem: "Outra" }, { origem: "" }, { motivo: "Alterado" }] as Record<string, string>[]) assert.throws(() => workflowValues(workflow, submitted, { channel: "INTERNO", previous: before, afterProtocol: true }));
  assert.equal(workflowValues(workflow, { complemento: "Análise" }, { channel: "INTERNO", previous: before, afterProtocol: true }).complemento, "Análise");
  assert.deepEqual(before, { origem: "Atendimento", motivo: "Original", complemento: "" });
});

test("data inicial segue Brasília, é persistida e não muda na reabertura", () => {
  const workflow = input([{ key: "data", label: "Data", type: "date", defaultToday: true, locked: true }]);
  const first = workflowValues(workflow, {}, { channel: "EXTERNO", now: new Date("2027-01-01T01:00:00Z") });
  assert.equal(first.data, "2026-12-31"); assert.equal(businessDate(new Date("2027-01-01T03:00:00Z")), "2027-01-01");
  assert.equal(workflowValues(workflow, {}, { channel: "EXTERNO", previous: first, now: new Date("2027-02-01T12:00:00Z") }).data, first.data);
});

test("apresentação e imagem de ajuda não aceitam conteúdo executável; configuração impede dependência interna externa", () => {
  assert.equal(workflowSchema.safeParse({ ...input([]), fields: [{ key: "a", label: "A", type: "text", helpImage: "javascript:alert(1)" }] }).success, false);
  assert.throws(() => input([{ key: "segredo", label: "Segredo", type: "text", visibility: "INTERNO" }, { key: "visivel", label: "Visível", type: "text", rules: [{ action: "EXIBIR", condition: { field: "segredo", equals: "confidencial" } }] }]), /exclusivamente interno/);
  const workflow = input([{ key: "titulo", label: "Atendimento municipal", type: "heading", required: true }]);
  assert.doesNotThrow(() => workflowValues(workflow, {}, { channel: "EXTERNO" }));
  assert.throws(() => workflowValues(workflow, { titulo: "Valor" }, { channel: "EXTERNO" }), /apresentação/);
});

test("cálculos ignoram valores enviados e campos de outro canal; erro posterior não altera a origem", () => {
  const workflow = input([{ key: "a", label: "A", type: "number", editAfterProtocol: "AMBOS" }, { key: "b", label: "B", type: "number", editAfterProtocol: "AMBOS" }, { key: "total", label: "Total", type: "number", calculation: { operation: "sum", fields: ["a", "b"], decimals: 2 } }]);
  const previous = { a: "2", b: "3", total: "5.00" };
  assert.equal(workflowValues(workflow, { a: "4", total: "100000" }, { channel: "EXTERNO", afterProtocol: true, previous }).total, "7.00");
  assert.throws(() => workflowValues(workflow, { a: "" }, { channel: "EXTERNO", afterProtocol: true, previous }), /preencha/);
  assert.deepEqual(previous, { a: "2", b: "3", total: "5.00" });
});
