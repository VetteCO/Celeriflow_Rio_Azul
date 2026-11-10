import { test } from "node:test";
import assert from "node:assert/strict";
import { businessDay, sanitizeDocumentHtml, formatNumber } from "./numbering";

test("virada documental segue o dia de São Paulo, inclusive na virada do ano UTC", () => {
  assert.equal(businessDay(new Date("2027-01-01T02:59:59Z")), "20261231");
  assert.equal(businessDay(new Date("2027-01-01T03:00:00Z")), "20270101");
  assert.equal(businessDay(new Date("2024-03-01T02:00:00Z")), "20240229");
  assert.throws(() => businessDay(new Date("invalid")));
  assert.equal(formatNumber("MEMORANDUM", 7, 2026), "MEM-000007/2026");
  assert.equal(formatNumber("MEMORANDUM", 7, 2026, "2026111000007"), "2026111000007");
});
test("editor preserva formatação e remove atributos, esquemas e conteúdo executáveis", () => {
  const safe = sanitizeDocumentHtml('<p style="text-align:center;position:fixed"><strong>Texto</strong><em> formatado</em><u> final</u></p><script>alert(1)</script><img src="https://example.invalid/image.png" onerror="alert(1)"><a href="javascript:alert(1)">link</a>');
  assert.ok(safe.includes("text-align:center") && safe.includes("<strong>") && safe.includes("<em>") && safe.includes("<u>"));
  for (const forbidden of ["onerror", "javascript:", "<script", "position", "alert(1)"]) assert.ok(!safe.includes(forbidden));
});
