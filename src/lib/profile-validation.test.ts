import { test } from "node:test";
import assert from "node:assert/strict";
import { profileDetailsSchema, cpfField, preferencesField } from "./profile-validation";
import { can } from "./rbac";

test("ficha funcional rejeita nascimento impossível, identificador incorreto e política sem limite", () => {
  for (const value of ["2026-02-30", "1900-02-29", "2999-01-01"]) assert.equal(profileDetailsSchema.safeParse({ birthDate: value }).success, false);
  assert.equal(profileDetailsSchema.safeParse({ birthDate: "2000-02-29", inactivityDays: 90 }).success, true);
  for (const value of [0, -1, 366, 1.5]) assert.equal(profileDetailsSchema.safeParse({ inactivityDays: value }).success, false);
  assert.equal(cpfField.safeParse("99999999999").success, false);
  assert.equal(cpfField.parse("529.982.247-25"), "52998224725");
});
test("preferências aceitam apenas opções conhecidas e foto incorporada de imagem", () => {
  for (const photo of ["javascript:alert(1)", "https://tracker.invalid/pixel", "data:image/svg+xml;base64,AAAA", "data:text/html;base64,AAAA"]) assert.equal(profileDetailsSchema.safeParse({ photo }).success, false);
  assert.equal(profileDetailsSchema.safeParse({ photo: "data:image/png;base64,aGVsbG8=", editor: "BASICO", phonePublic: false }).success, true);
  assert.equal(profileDetailsSchema.safeParse({ editor: "OUTRO" }).success, false);
  assert.equal(preferencesField.safeParse({ email: "Sim" }).success, false);
});
test("perfis separam leitura, operação setorial e administração", () => {
  for (const permission of ["doc:create", "doc:edit", "doc:receive", "doc:forward", "doc:archive", "admin:users"]) assert.equal(can("NIVEL_3_VISUALIZACAO", permission), false);
  assert.equal(can("NIVEL_3_VISUALIZACAO", "doc:view"), true);
  assert.equal(can("NIVEL_2", "admin:users"), false);
  assert.equal(can("NIVEL_1", "admin:users"), true);
  assert.equal(can("AUDITOR", "doc:edit"), true);
  assert.equal(can("AUDITOR", "admin:users"), false);
});
