import { test } from "node:test";
import assert from "node:assert/strict";
import { availableActions } from "./actions";
import { workflowSchema } from "./domain";
import { effectiveDepartmentIds } from "../department-scope";
import { searchServices, type PublicService } from "./service-search";

const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222";
const workflow = workflowSchema.parse({ family: "processos", fields: [], steps: [{ name: "Instrução", hours: 8, departments: [a, b] }, { name: "Decisão", hours: 24, departments: [b], decision: true }] });
const row = { family: "processos", status: "EM_ANDAMENTO", ownerId: "autor", departmentId: a, data: { workflow, step: 0, completedDepartments: [] as string[] } };
const actor = { writable: true, admin: true, userId: "autor", departmentIds: [a] };
test("capacidades exigem todos os setores, última etapa e setor autorizado", () => {
  assert.ok(availableActions(row, actor).includes("CONCLUIR_SETOR"));
  for (const action of ["AVANCAR", "DEFERIR", "INDEFERIR"]) assert.ok(!availableActions(row, actor).includes(action));
  assert.ok(!availableActions({ ...row, data: { ...row.data, completedDepartments: [a] } }, actor).includes("AVANCAR"));
  assert.ok(availableActions({ ...row, data: { ...row.data, completedDepartments: [a, b] } }, actor).includes("AVANCAR"));
  const final = { ...row, data: { ...row.data, step: 1, completedDepartments: [b] } };
  assert.ok(!availableActions(final, actor).includes("DEFERIR"));
  assert.ok(availableActions(final, { ...actor, departmentIds: [b] }).includes("DEFERIR"));
  assert.ok(!availableActions(final, { ...actor, departmentIds: [b] }).includes("AVANCAR"));
  assert.deepEqual(availableActions(row, { ...actor, writable: false }), []);
  assert.deepEqual(availableActions({ ...row, status: "PUBLICADO" }, actor), []);
});
test("leitura ampliada e execução em segundo plano usam o mesmo escopo setorial", () => {
  const sectors = [{ id: a, parentId: null }, { id: b, parentId: a }, { id: "externo", parentId: null }];
  assert.deepEqual(effectiveDepartmentIds(a, ["inativo"], ["NIVEL_1"], sectors), [a, b]);
  assert.deepEqual(effectiveDepartmentIds(a, [], ["ADMIN_GERAL"], sectors), [a]);
  assert.deepEqual(effectiveDepartmentIds(null, [], ["AUDITOR"], sectors), [a, b, "externo"]);
});
test("Carta busca descrições, vocabulário e filtros sem confundir acentos", () => {
  const services: PublicService[] = [
    { id: "1", family: "carta", title: "Iluminação pública", body: "Manutenção dos equipamentos", code: "1", values: { categoria: "Urbanismo", publico: "Moradores" } },
    { id: "2", family: "carta", title: "Conservação", body: "Poda de árvores em vias municipais", code: "2", values: { categoria: "Meio ambiente", publico: "Moradores" } },
  ];
  assert.deepEqual(searchServices(services, "preciso trocar a lampada").map(s => s.id), ["1"]);
  assert.deepEqual(searchServices(services, "árvores").map(s => s.id), ["2"]);
  assert.equal(searchServices(services, "luz", "Meio ambiente").length, 0);
  assert.equal(searchServices(services, "", "Urbanismo", "Empresas").length, 0);
});
