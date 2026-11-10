import { before, test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogNode, ClassifiedAct } from "./diary-catalog";

// Import the actual exports without loading any configured remote database URL.
// These tests call only the synchronous catalogPath/classifyAct functions.
let catalogPath: typeof import("./diary-catalog").catalogPath;
let classifyAct: typeof import("./diary-catalog").classifyAct;
before(async () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/catalog_pure_tests";
  try { ({ catalogPath, classifyAct } = await import("./diary-catalog")); }
  finally { if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous; }
});
function nodes(): CatalogNode[] {
  return [
    { id: "book", parentId: null, kind: "CADERNO", name: "Executivo", position: 2, revision: 3 },
    { id: "section", parentId: "book", kind: "SECAO", name: "Administração", position: 7, revision: 2 },
    { id: "subsection", parentId: "section", kind: "SUBSECAO", name: "Portarias", position: 1, revision: 4 },
  ].map(n => ({ ...n, active: true, actorId: "actor", note: "Configuração de ensaio" }));
}
function act(): ClassifiedAct { return { id: "act", code: "2026111000001", title: "Portaria", body: "Texto original", revision: 6, section: "Antigo", subsection: "Anterior", withdrawn: true, blocks: [{ type: "paragraph", text: "Texto preservado", bold: false, italic: false, underline: false, align: "left", size: 12 }] }; }

test("snapshot hierárquico segue os pais, independentemente da ordem ou posição das linhas", () => {
  const source = nodes().reverse(); const before = structuredClone(source);
  const path = catalogPath("subsection", source);
  assert.deepEqual(path.map(n => n.id), ["book", "section", "subsection"]);
  assert.deepEqual(path.map(n => n.position), [2, 7, 1]);
  assert.deepEqual(path.map(n => n.revision), [3, 2, 4]);
  assert.deepEqual(source, before);
  assert.deepEqual(Object.keys(path[0]).sort(), ["id", "parentId", "kind", "name", "position", "revision"].sort());
  source.find(n => n.id === "book")!.name = "Nome novo";
  assert.equal(path[0].name, "Executivo", "snapshot não deve referenciar o cadastro mutável");
});

test("caderno sozinho e seção sem subseção são classificações válidas", () => {
  const source = nodes();
  assert.equal(catalogPath("book", source).length, 1);
  const notebook = classifyAct(act(), catalogPath("book", source));
  assert.equal(notebook.section, "Executivo"); assert.equal(notebook.subsection, "");
  const section = classifyAct(act(), catalogPath("section", source));
  assert.equal(section.section, "Executivo / Administração"); assert.equal(section.subsection, "");
});

test("classificar preserva ato, conteúdo, revisão e retirada sem modificar entradas", () => {
  const original = act(); const path = catalogPath("subsection", nodes());
  const originalBefore = structuredClone(original), pathBefore = structuredClone(path);
  Object.freeze(original); path.forEach(Object.freeze); Object.freeze(path);
  const result = classifyAct(original, path);
  assert.notEqual(result, original);
  assert.deepEqual(original, originalBefore); assert.deepEqual(path, pathBefore);
  assert.equal(result.section, "Executivo / Administração"); assert.equal(result.subsection, "Portarias");
  assert.deepEqual(result.catalogPath, pathBefore);
  for (const key of ["id", "code", "title", "body", "revision", "withdrawn", "blocks"] as const) assert.deepEqual(result[key], original[key]);
});

test("reclassificação não reescreve snapshot anterior serializado", () => {
  const source = nodes(); const previous = classifyAct(act(), catalogPath("subsection", source));
  const bytes = JSON.stringify(previous);
  source[0].name = "Executivo reorganizado"; source[0].revision++;
  const next = classifyAct(previous, catalogPath("book", source));
  assert.equal(JSON.stringify(previous), bytes);
  assert.equal(next.section, "Executivo reorganizado"); assert.equal(next.subsection, "");
  assert.equal(previous.catalogPath![0].name, "Executivo");
});

test("rejeita destino ausente, pai ausente e inatividade em qualquer ancestral", () => {
  assert.throws(() => catalogPath("missing", nodes()), /inexistente|inativa|cíclica/);
  assert.throws(() => catalogPath("subsection", nodes().filter(n => n.id !== "section")), /inexistente/);
  for (const id of ["book", "section", "subsection"]) {
    const source = nodes(); source.find(n => n.id === id)!.active = false;
    assert.throws(() => catalogPath("subsection", source), /inativa/);
  }
});

test("rejeita autorreferência e ciclos entre ancestrais sem travar a travessia", () => {
  const self = nodes(); self[2].parentId = "subsection";
  assert.throws(() => catalogPath("subsection", self), /cíclica/);
  const cycle = nodes(); cycle[0].parentId = "subsection";
  assert.throws(() => catalogPath("subsection", cycle), /cíclica/);
});

test("rejeita níveis invertidos, raiz seção, salto de seção e quarto nível", () => {
  const root = nodes(); root[0].kind = "SECAO";
  assert.throws(() => catalogPath("book", root), /Estrutura/);
  const skipped = nodes(); skipped[2].parentId = "book";
  assert.throws(() => catalogPath("subsection", skipped), /Estrutura/);
  const inverted = nodes(); inverted[1].kind = "SUBSECAO"; inverted[2].kind = "SECAO";
  assert.throws(() => catalogPath("subsection", inverted), /Estrutura/);
  const fourth = nodes(); fourth.push({ ...fourth[2], id: "fourth", parentId: "subsection" });
  assert.throws(() => catalogPath("fourth", fourth), /Estrutura/);
});
