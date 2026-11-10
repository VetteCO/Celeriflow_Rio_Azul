// Small, dependency-free exports: PDF 1.4 (WinAnsi), OOXML inline strings and ZIP STORE.
export function csv(rows: (string | number | null)[][]) {
  return "\uFEFF" + rows.map(row => row.map(value => {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(";")).join("\r\n");
}
export function pdf(lines: string[]) {
  const wrapped = lines.flatMap(line => line.match(/.{1,105}/g) || [""]);
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += 48) pages.push(wrapped.slice(i, i + 48));
  if (!pages.length) pages.push([]);
  const objects: Buffer[] = [];
  const add = (s: string | Buffer) => objects.push(Buffer.isBuffer(s) ? s : Buffer.from(s, "latin1"));
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  pages.forEach((page, i) => {
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    const escape = (s: string) => s.replace(/[^\x20-\xFF]/g, " ").replace(/([\\()])/g, "\\$1");
    const stream = Buffer.from(`BT /F1 10 Tf 40 800 Td 15 TL ${page.map(s => `(${escape(s)}) Tj T*`).join("\n")} ET`, "latin1");
    add(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream")]));
  });
  const chunks = [Buffer.from("%PDF-1.4\n")]; const offsets = [0]; let offset = chunks[0].length;
  objects.forEach((body, i) => { offsets.push(offset); const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from("\nendobj\n")]); chunks.push(chunk); offset += chunk.length; });
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`));
  return Buffer.concat(chunks);
}
function crc32(bytes: Buffer) { let c = 0xffffffff; for (let i=0;i<bytes.length;i++) { c ^= bytes[i]; for (let k=0;k<8;k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
export function zip(files: { name: string; data: Buffer }[]) {
  const chunks: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name); const crc = crc32(file.data); const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20,4); local.writeUInt16LE(0x800,6); local.writeUInt32LE(crc,14); local.writeUInt32LE(file.data.length,18); local.writeUInt32LE(file.data.length,22); local.writeUInt16LE(name.length,26);
    const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(20,4); dir.writeUInt16LE(20,6); dir.writeUInt16LE(0x800,8); dir.writeUInt32LE(crc,16); dir.writeUInt32LE(file.data.length,20); dir.writeUInt32LE(file.data.length,24); dir.writeUInt16LE(name.length,28); dir.writeUInt32LE(offset,42);
    chunks.push(local,name,file.data); central.push(dir,name); offset += local.length+name.length+file.data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,directory,end]);
}
export function xlsx(rows: (string | number | null)[][]) {
  const xml = (v: unknown) => String(v ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const files: Record<string,string> = {
    "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Relatorio" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r,i) => `<row r="${i+1}">${r.map(v => typeof v === "number" ? `<c><v>${v}</v></c>` : `<c t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`,
  };
  return zip(Object.entries(files).map(([name,data]) => ({ name, data: Buffer.from(data) })));
}
