import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = "docs/MATRIZ_REQUISITOS_IMPLANTACAO.md";
const output = "docs/CONTROLE_REQUISITOS.json";
const matrix = readFileSync(source, "utf8").replace(/\r\n/g, "\n");
const groups: Record<string, unknown>[] = [];
const ids = new Set<string>();
const articles = new Set<string>();
for (const line of matrix.split("\n")) {
  const cells = line.split("|").slice(1, -1).map(cell => cell.trim());
  const id = cells[0]?.match(/^([A-Z]+-(?:P\d+|TR\d+|TAB)-\d+)(?:\s+·|$)/)?.[1];
  if (!id) continue;
  if (cells.length === 3 && !id.startsWith("UI-")) continue; // Incremental evidence is not a second requirement definition.
  assert.ok(!ids.has(id), `ID duplicado: ${id}`); ids.add(id);
  assert.ok(cells.length === 4 || cells.length === 3, `Colunas inválidas: ${id}`);
  const text = cells[1];
  const markers = [...text.matchAll(/(?:^|[;:]\s+)([a-z])\)\s*/g)];
  markers.forEach((marker, index) => assert.equal(marker[1], String.fromCharCode(97 + index), `Sequência de alíneas inválida: ${id}`));
  const requirements = markers.length ? markers.map((marker, index) => ({
    id: `${id}.${marker[1]}`,
    text: text.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? text.length).trim(),
  })) : [{ id, text }];
  for (const requirement of requirements) { assert.ok(!articles.has(requirement.id)); articles.add(requirement.id); }
  groups.push({ id, source: cells[0].includes("·") ? cells[0].split("·").slice(1).join("·").trim() : "Padrão de Tabelas.md", scopeAndStages: cells.length === 4 ? cells[2] : "5; adoção em 1–9 e 13", owner: "Celeriflow — responsável técnico pela entrega", acceptanceOwner: id.startsWith("UI-") ? "Proprietário do produto" : "Município/comissão/fiscal, conforme marco contratual", fullText: text, acceptanceCriteria: cells.at(-1), requirements: requirements.map(requirement => ({ ...requirement, status: "planejado", individualAcceptance: "pendente", evidence: [], note: "Estado inicial de controle individual; registros incrementais da matriz preservam evidências parciais. Não indica ausência de implementação nem aceite automático." })) });
}
assert.equal(groups.filter(group => String(group.id).startsWith("POC-")).length, 9);
assert.equal(groups.filter(group => String(group.id).startsWith("UI-")).length, 6);
assert.ok(groups.length > 100 && articles.size > groups.length);
const data = { version: 1, source, sourceSha256: createHash("sha256").update(matrix).digest("hex"), purpose: "Índice gerado de tarefas e alíneas; não substitui evidências incrementais nem homologação.", workflow: ["planejado", "em desenvolvimento", "implementado", "testado internamente", "validado em tela", "homologado"], evidenceFields: ["requirementId", "status", "version", "environment", "date", "responsible", "scenario", "expected", "actual", "artifact", "pending"], groups };
const serialized = JSON.stringify(data, null, 2) + "\n";
if (process.argv.includes("--write")) writeFileSync(output, serialized);
else assert.equal(readFileSync(output, "utf8").replace(/\r\n/g, "\n"), serialized, "Índice desatualizado: execute npm run stage0:register -- --write.");
console.log(JSON.stringify({ groups: groups.length, individualRequirements: articles.size, poc: 9, interface: 6, output, mode: process.argv.includes("--write") ? "generated" : "verified" }));
