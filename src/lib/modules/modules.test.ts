import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, measure, validTaxId, validateGeometry, validateWorkflowFields, workflowSchema, blockSchema } from "./domain";
import { canRead, redacted } from "./policy";
import type { ModuleRecord } from "@/db/modules-schema";
import { csv, parseCsv } from "./formats";

test("identificadores fiscais rejeitam repetição e verificadores incorretos", () => {
  assert.equal(validTaxId("529.982.247-25"), true);
  assert.equal(validTaxId("11.222.333/0001-81"), true);
  for (const id of ["99999999999", "12345678900", "11222333000180", "123"]) assert.equal(validTaxId(id), false);
});
test("campos condicionais são exigidos apenas quando aplicáveis", () => {
  const workflow = workflowSchema.parse({ family: "processos", steps: [{ name: "Análise", departments: ["11111111-1111-4111-8111-111111111111"], hours: 24 }], fields: [{ key: "motivo", label: "Motivo", type: "text", required: true, condition: { field: "opcao", equals: "Sim" } }] });
  assert.doesNotThrow(() => validateWorkflowFields(workflow, { opcao: "Não" }));
  assert.throws(() => validateWorkflowFields(workflow, { opcao: "Sim" }), /Motivo/);
});
test("geometria rejeita coordenadas fora de WGS84 e polígonos abertos", () => {
  const collection = (geometry: unknown) => ({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry }] });
  assert.throws(() => validateGeometry(collection({ type: "Point", coordinates: [181, 0] })));
  assert.throws(() => validateGeometry(collection({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] })));
  assert.equal(validateGeometry(collection({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] })).features.length, 1);
});
test("medições preservam escala dimensional e proximidade geográfica", () => {
  assert.equal(measure([[0, 0], [3, 4]], 2, "distancia"), 10);
  assert.ok(Math.abs(measure([[0, 0], [10, 0], [10, 10], [0, 10]], 0.1, "area") - 1) < 0.000001);
  assert.ok(Math.abs(distanceMeters([0, 0], [1, 0]) - 111195) < 2);
  assert.throws(() => measure([[0, 0], [1, 1]], -1, "distancia"));
});
test("conteúdo formatado bloqueia esquemas executáveis", () => {
  assert.equal(blockSchema.safeParse({ type: "link", label: "Abrir", url: "javascript:alert(1)" }).success, false);
  assert.equal(blockSchema.safeParse({ type: "image", caption: "Imagem", url: "data:text/html,<script>" }).success, false);
});
test("CSV preserva separadores e linhas citadas e neutraliza fórmulas", () => {
  assert.deepEqual(parseCsv('nome;observacao\r\n"Ana; Maria";"linha 1\nlinha 2"'), [["nome", "observacao"], ["Ana; Maria", "linha 1\nlinha 2"]]);
  assert.ok(csv([["=HYPERLINK(1)"]]).includes("'=HYPERLINK"));
  assert.throws(() => parseCsv('nome;"não fechado'));
});
test("administrador fora do escopo não lê documento e sigilo não vaza ao setor participante", () => {
  const ctx = { user: { id: "servidor", departmentId: "obras" }, session: { roles: ["ADMIN_GERAL"], departmentIds: ["obras"] } };
  const row: ModuleRecord = { id: "registro", code: "2026111000001", title: "Manifestação", body: "Conteúdo", status: "EM_ANDAMENTO", revision: 1, actorId: "atendente", externalOwnerUid: null, externalOwnerEmail: null, externalActorUid: null, action: "CRIADO", note: "", publicKey: "chave", idempotencyKey: null, createdAt: new Date(), updatedAt: new Date(), family: "ouvidoria", ownerId: "atendente", departmentId: "ouvidoria", participants: ["obras"], access: "SETOR", data: { values: { modalidade: "Sigilosa" }, identityDepartmentId: "ouvidoria", identity: { name: "Pessoa", email: "pessoa@example.com", cpfCnpj: "", phone: "" } } };
  assert.equal(canRead(row, ctx), true);
  assert.equal(redacted(row, ctx).data.identity, undefined);
  assert.ok(row.data.identity, "a redação não modifica a fonte preservada");
  assert.equal(canRead({ ...row, participants: [] }, ctx), false);
  assert.equal(canRead({ ...row, access: "RESTRITO" }, ctx), false);
});
