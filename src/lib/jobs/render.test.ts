import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceHtml } from "./render";
test("PDF preserva imagens DOCX incorporadas e bloqueia conteúdo executável", () => {
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ZkAAAAASUVORK5CYII=";
  const html = sourceHtml({ id: "document", type: "module", code: "2026111000001", title: "Ofício", body: '<script>alert(1)</script><img src="data:image/svg+xml;base64,PHN2Zz4=" onerror="alert(1)"><a href="javascript:alert(1)">Link</a>', blocks: [{ type:"image",url:pixel,caption:"Imagem do original" }] });
  assert.ok(html.includes(pixel));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("onerror"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("data:image/svg"));
});
