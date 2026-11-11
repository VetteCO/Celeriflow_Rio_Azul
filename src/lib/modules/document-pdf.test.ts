import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName } from "pdf-lib";
import { documentPdf } from "./document-pdf";
import { signersSchema, signatureContent, canRequestSignature } from "./signatures";
import { renderTemplateBlocks } from "./domain";
test("modelo aplica as mesmas variáveis em texto, células, link e legenda sem alterar a origem", () => {
  const source = [{ type: "table" as const, rows: [["{{assunto}}", "{{data}}"]] }, { type: "link" as const, label: "{{assunto}}", url: "https://example.org/{{codigo}}" }, { type: "image" as const, caption: "{{assunto}}", url: "https://example.org/brasao.png" }];
  const result = renderTemplateBlocks(source, { assunto: "Acervo", data: "10/11/2026", codigo: "arquivo" });
  assert.ok(!JSON.stringify(result).includes("{{")); assert.ok(JSON.stringify(source).includes("{{"));
});
test("fila permite etapas paralelas/sequenciais, rejeita duplicação e saltos e preserva hash canônico", () => {
  const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
  assert.ok(signersSchema.safeParse(ids.map((userId, i) => ({ userId, order: i < 2 ? 1 : 2 }))).success);
  assert.ok(!signersSchema.safeParse([{ userId: ids[0], order: 1 }, { userId: ids[0], order: 2 }]).success);
  assert.ok(!signersSchema.safeParse([{ userId: ids[0], order: 2 }]).success);
  assert.equal(signatureContent({ title: "A", data: { b: 1, a: 2 }, files: [] }), signatureContent({ files: [], data: { a: 2, b: 1 }, title: "A" }));
  assert.ok(!canRequestSignature({ family: "ged", status: "EM_ANDAMENTO", data: { signatures: [{ userId: ids[0], order: 1, status: "PENDENTE", revision: 1 }] } }));
  assert.ok(!canRequestSignature({ family: "ged", status: "CANCELADO", data: {} }));
});
test("PDF pagina célula maior que uma página e preserva links sem scripts", async () => {
  const bytes = await documentPdf({ title: "Acervo", code: "2026111000001", revision: 1, status: "EM_ANDAMENTO", createdAt: "2026-11-10", family: "Acervo documental", body: "Conteúdo administrativo.", blocks: [{ type: "table", rows: [["Texto extenso ".repeat(800), "Fim da célula"]] }, { type: "link", label: "Consulta", url: "https://example.org/arquivo" }], fields: [], files: [], history: [] });
  const pdf = await PDFDocument.load(bytes); assert.ok(pdf.getPageCount() > 2); assert.ok(pdf.getPages().some(page => (page.node.Annots()?.size() ?? 0) > 0)); assert.equal(pdf.catalog.get(PDFName.of("OpenAction")), undefined);
});
