import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ContentBlock } from "./domain";

type Printable = { title: string; code: string; revision: number; status: string; createdAt: string; family: string; body: string; blocks: ContentBlock[]; fields: [string, string][]; history: string[]; files: string[]; qr?: Uint8Array };
const width = 595.28, height = 841.89, margin = 45, usable = width - margin * 2, bottom = 48;
function printable(text: string, font: PDFFont) {
  return Array.from(text.replace(/\t/g, "    ")).map(char => { if (char === "\n" || char === "\r") return char; try { font.encodeText(char); return char; } catch { return "?"; } }).join("");
}
function wrap(text: string, font: PDFFont, size: number, max: number) {
  const lines: string[] = [];
  for (const paragraph of printable(text, font).split(/\r?\n/)) {
    let line = "";
    for (const char of paragraph) {
      if (line && font.widthOfTextAtSize(line + char, size) > max) { lines.push(line); line = ""; }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
/** Native A4 export: typed blocks, embedded images, links and paginated tables. Originals are untouched. */
export async function documentPdf(record: Printable, cover = false) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(record.title); pdf.setSubject(`${record.family} ${record.code} · revisão ${record.revision}`); pdf.setCreator("Celeriflow");
  const fonts = await Promise.all([StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique].map(font => pdf.embedFont(font)));
  let page: PDFPage = pdf.addPage([width, height]), y = height - margin;
  const newPage = () => { page = pdf.addPage([width, height]); y = height - margin; };
  const ensure = (space: number) => { if (y - space < bottom) newPage(); };
  const paragraph = (text: string, size = 11, font = fonts[0], align = "left", underline = false) => {
    const lineHeight = size * 1.4;
    for (const line of wrap(text, font, size, usable)) {
      ensure(lineHeight);
      const length = font.widthOfTextAtSize(line, size), x = align === "center" ? (width - length) / 2 : align === "right" ? width - margin - length : margin;
      page.drawText(line, { x, y: y - size, size, font });
      if (underline && length) page.drawLine({ start: { x, y: y - size - 2 }, end: { x: x + length, y: y - size - 2 }, thickness: 0.6 });
      y -= lineHeight;
    }
    y -= 6;
  };
  paragraph(record.family, 11, fonts[1]); paragraph(record.title, 18, fonts[1]);
  paragraph(`Código: ${record.code} | Revisão: ${record.revision} | Situação: ${record.status.replaceAll("_", " ")}`, 9);
  paragraph(`Criado em: ${record.createdAt}`, 9); paragraph("Documento sem assinatura digital.", 9);
  if (record.qr) {
    ensure(120); const image = await pdf.embedPng(record.qr); page.drawImage(image, { x: margin, y: y - 82, width: 82, height: 82 }); y -= 90;
    paragraph("Consulta digital com acesso institucional autorizado. O QR não comprova entrega, ciência ou assinatura.", 8);
  }
  if (!cover) {
    if (record.body) paragraph(record.body);
    for (const block of record.blocks) {
      if (block.type === "paragraph") paragraph(block.text, block.size * 0.75, fonts[(block.bold ? 1 : 0) + (block.italic ? 2 : 0)], block.align, block.underline);
      else if (block.type === "link") {
        for (const line of wrap(`${block.label || block.url} (${block.url})`, fonts[0], 10, usable)) {
          ensure(17); const length = fonts[0].widthOfTextAtSize(line, 10);
          page.drawText(line, { x: margin, y: y - 10, size: 10, font: fonts[0], color: rgb(0.05, 0.25, 0.55) });
          const annotation = pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [margin, y - 13, margin + length, y + 2], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(block.url) } }));
          page.node.addAnnot(annotation); y -= 17;
        }
        y -= 6;
      } else if (block.type === "image") {
        // External images are rendered by the network-isolated asynchronous worker.
        // Native export only consumes embedded originals, never arbitrary server-side URLs.
        if (!block.url.startsWith("data:")) { paragraph(`Imagem externa: ${block.caption}. Para incorporá-la, utilize Compilar PDF na aba Processamento.`, 10); continue; }
        const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(block.url);
        if (!match || block.url.length > 3000000) throw new Error("Imagem incorporada inválida.");
        const bytes = Buffer.from(match[2], "base64");
        let image;
        try { image = match[1] === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes); } catch { throw new Error("Não foi possível ler a imagem incorporada. Utilize PNG ou JPEG válido."); }
        const fitted = image.scaleToFit(usable, 520); ensure(fitted.height + 35);
        page.drawImage(image, { x: (width - fitted.width) / 2, y: y - fitted.height, ...fitted }); y -= fitted.height + 6;
        if (block.caption) paragraph(block.caption, 9);
      } else {
        const columns = Math.max(...block.rows.map(row => row.length)), cellWidth = usable / columns, size = 9, lineHeight = 13;
        for (const row of block.rows) {
          const cells = Array.from({ length: columns }, (_, i) => wrap(row[i] ?? "", fonts[0], size, cellWidth - 10));
          const count = Math.max(...cells.map(lines => lines.length)); let offset = 0;
          while (offset < count) {
            ensure(lineHeight + 10);
            const capacity = Math.max(1, Math.floor((y - bottom - 10) / lineHeight)), take = Math.min(count - offset, capacity), rowHeight = take * lineHeight + 10;
            for (let i = 0; i < columns; i++) {
              const x = margin + i * cellWidth;
              page.drawRectangle({ x, y: y - rowHeight, width: cellWidth, height: rowHeight, borderWidth: 0.5, borderColor: rgb(0.4, 0.4, 0.4) });
              for (let n = 0; n < take; n++) page.drawText(cells[i][offset + n] ?? "", { x: x + 5, y: y - 5 - size - n * lineHeight, font: fonts[0], size });
            }
            y -= rowHeight; offset += take;
            if (offset < count) newPage();
          }
        }
        y -= 10;
      }
    }
    if (record.fields.length) { paragraph("Informações do documento", 12, fonts[1]); for (const [label, value] of record.fields) paragraph(`${label}: ${value || "—"}`, 10); }
    if (record.history.length) { paragraph("Histórico de versões", 12, fonts[1]); for (const event of record.history) paragraph(event, 9); }
    if (record.files.length) { paragraph("Anexos originais preservados separadamente", 12, fonts[1]); for (const file of record.files) paragraph(file, 9); }
  } else for (const [label, value] of record.fields) paragraph(`${label}: ${value || "—"}`, 10);
  const pages = pdf.getPages();
  pages.forEach((p, i) => { p.drawText(`${record.code} | Página ${i + 1} de ${pages.length}`, { x: margin, y: 25, size: 8, font: fonts[0] }); });
  // Keep standard URI annotations in the saved PDF; no embedded scripts or forms.
  pdf.catalog.delete(PDFName.of("OpenAction"));
  return pdf.save();
}
