// Small text PDF renderer. This is an ordinary PDF, not PDF/A or a signed artifact.
export function textPdf(title: string, lines: string[]) {
  const wrapped = [title, "", ...lines].flatMap(line => {
    const result: string[] = [];
    for (const part of line.split(/\r?\n/)) {
      let remaining = part;
      while (remaining.length > 95) { let cut = remaining.lastIndexOf(" ", 95); if (cut < 20) cut = 95; result.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).trimStart(); }
      result.push(remaining);
    }
    return result;
  });
  const pages: string[][] = []; for (let i = 0; i < wrapped.length; i += 48) pages.push(wrapped.slice(i, i + 48));
  const escape = (value: string) => value.replace(/[^\x20-\xFF]/g, "?").replace(/[\\()]/g, "\\$&");
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"];
  const ids: number[] = [];
  pages.forEach((page, index) => {
    const id = objects.length + 1; ids.push(id);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`);
    const content = `BT /F1 10 Tf 14 TL 40 800 Td ${page.map(line => `(${escape(line)}) Tj T*`).join("\n")} ET\nBT /F1 9 Tf 40 30 Td (Página ${index + 1} de ${pages.length}) Tj ET`;
    objects.push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${ids.map(id => `${id} 0 R`).join(" ")}] >>`;
  let output = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(output, "latin1")); output += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "latin1");
}
export function csv(rows: string[][]) {
  return "\uFEFF" + rows.map(row => row.map(cell => `"${(/^[=+\-@\t\r]/.test(cell) ? "'" : "") + cell.replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
export function parseCsv(text: string) {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ";" && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV contém aspas não fechadas.");
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
