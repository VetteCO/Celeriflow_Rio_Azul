import sanitizeHtml from "sanitize-html";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DocumentJob } from "@/db/jobs-schema";
import type { JobFile, JobSource } from "./types";
import { ConfigurationError, PermanentError } from "./types";
import { binary, run } from "./commands";

export const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function sourceHtml(source: JobSource) {
  const blocks = source.blocks.map(b => {
    if (b.type === "paragraph") return `<p style="text-align:${b.align};font-size:${b.size}px;font-weight:${b.bold ? "bold" : "normal"};font-style:${b.italic ? "italic" : "normal"};text-decoration:${b.underline ? "underline" : "none"}">${escape(b.text).replace(/\n/g, "<br>")}</p>`;
    if (b.type === "table") return `<table>${b.rows.map(r => `<tr>${r.map(c => `<td>${escape(c)}</td>`).join("")}</tr>`).join("")}</table>`;
    if (b.type === "link") return `<p><a href="${escape(b.url)}">${escape(b.label)}</a></p>`;
    return `<figure><img src="${escape(b.url)}"><figcaption>${escape(b.caption)}</figcaption></figure>`;
  }).join("");
  const body = /<\/?[a-z][^>]*>/i.test(source.body) ? source.body : `<p>${escape(source.body).replace(/\n/g, "<br>")}</p>`;
  return sanitizeHtml(`<h1>${escape(source.title)}</h1><p>${escape(source.code)}${source.revision ? ` · Revisão ${source.revision}` : ""}</p>${body}${blocks}`, {
    allowedTags: ["h1", "h2", "h3", "h4", "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "a", "img", "figure", "figcaption", "hr"],
    allowedAttributes: { "*": ["style"], a: ["href"], img: ["src", "alt", "width", "height"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["https", "http"], allowedSchemesByTag: { img: ["https", "data"] },
    allowProtocolRelative: false,
    transformTags: { img: (_tag, attributes) => {
      const src = attributes.src ?? "";
      if (src.startsWith("data:") && (src.length > 3000000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src))) {
        const { src: _source, ...rest } = attributes; return { tagName: "img", attribs: rest };
      }
      return { tagName: "img", attribs: attributes };
    } },
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/], "font-size": [/^\d{1,2}(px|pt)$/], "font-weight": [/^(normal|bold|[1-9]00)$/], "font-style": [/^(normal|italic)$/], "text-decoration": [/^(none|underline|line-through)$/], color: [/^#[0-9a-f]{3,8}$/i], "background-color": [/^#[0-9a-f]{3,8}$/i], width: [/^\d{1,3}%$/] } },
  });
}
export function documentHtml(job: DocumentJob) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @page{size:A4;margin:20mm 16mm 22mm}body{font:12pt Arial,sans-serif;line-height:1.45;color:#111;overflow-wrap:anywhere}h1{font-size:20pt}h2{font-size:16pt}table{border-collapse:collapse;width:100%;table-layout:fixed}td,th{border:1px solid #666;padding:6px;overflow-wrap:anywhere}thead{display:table-header-group}tr,figure{break-inside:avoid}img{max-width:100%;height:auto}section{break-before:page}.cover{break-after:page}a{color:#145a87}pre{white-space:pre-wrap}
    </style></head><body><div class="cover"><h1>Compilação documental</h1><p>Código ${escape(job.code)}</p><p>Conteúdo capturado em ${escape(job.payload.capturedAt)}</p><p>Seleção ${job.payload.selection === "complete" ? "completa dos vínculos acessíveis" : "personalizada"}</p><h2>Documentos</h2><ol>${job.payload.sources.map(s => `<li>${escape(s.code)} — ${escape(s.title)}</li>`).join("")}</ol><h2>Anexos selecionados</h2><ul>${job.payload.files.map(f => `<li>${escape(f.filename)}</li>`).join("")}</ul></div>${job.payload.sources.map(s => `<section>${sourceHtml(s)}</section>`).join("")}</body></html>`;
}
export async function renderPdf(job: DocumentJob, files: { file: JobFile; path: string }[], directory: string, signal: AbortSignal) {
  const executablePath = await binary("JOBS_CHROMIUM_BIN");
  const { chromium } = await import("playwright-core");
  const html = documentHtml(job);
  const origins = new Set((process.env.JOBS_IMAGE_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean));
  const browser = await chromium.launch({ executablePath, headless: true });
  const abort = () => { void browser.close(); };
  signal.addEventListener("abort", abort, { once: true });
  const base = join(directory, "content.pdf");
  try {
    signal.throwIfAborted();
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    let blocked = false;
    await context.route("**/*", async route => {
      const request = route.request(); const url = new URL(request.url());
      if (request.resourceType() === "image" && ((url.protocol === "https:" && !url.username && !url.password && origins.has(url.origin)) || (request.url().length <= 3000000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(request.url())))) await route.continue();
      else { blocked = true; await route.abort(); }
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "networkidle", timeout: 45000 });
    const missing = await page.locator("img").evaluateAll(images => images.some(image => !(image as HTMLImageElement).complete || !(image as HTMLImageElement).naturalWidth));
    if (blocked || missing) throw new ConfigurationError("Imagens não puderam ser incorporadas. Configure JOBS_IMAGE_ORIGINS com origens HTTPS confiáveis e verifique a disponibilidade das imagens.");
    await page.pdf({ path: base, format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally { signal.removeEventListener("abort", abort); await browser.close(); }
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const merged = await PDFDocument.load(await readFile(base));
  if (merged.getPageCount() > 1000) throw new PermanentError("Compilação limitada a 1.000 páginas.");
  for (const { file, path } of files) {
    signal.throwIfAborted();
    const bytes = await readFile(path);
    if (file.mimeType === "application/pdf") {
      const annex = await PDFDocument.load(bytes);
      if (annex.getPageCount() + merged.getPageCount() > 1000) throw new PermanentError("Compilação limitada a 1.000 páginas.");
      for (const page of await merged.copyPages(annex, annex.getPageIndices())) merged.addPage(page);
    } else if (["image/png", "image/jpeg"].includes(file.mimeType)) {
      if (merged.getPageCount() >= 1000) throw new PermanentError("Compilação limitada a 1.000 páginas.");
      const image = file.mimeType === "image/png" ? await merged.embedPng(bytes) : await merged.embedJpg(bytes);
      const page = merged.addPage([595.28, 841.89]); const fitted = image.scaleToFit(500, 730);
      page.drawImage(image, { x: (595.28 - fitted.width) / 2, y: (841.89 - fitted.height) / 2, ...fitted });
    } else throw new PermanentError(`Anexo ${file.filename} não é PDF, PNG ou JPEG. Preserve-o no ZIP ou use seleção personalizada.`);
  }
  // A dedicated footer strip preserves all original content rather than painting over it.
  const output = await PDFDocument.create(); const font = await output.embedFont(StandardFonts.Helvetica);
  const embedded = await output.embedPages(merged.getPages());
  for (let i = 0; i < embedded.length; i++) {
    const source = embedded[i]; const page = output.addPage([source.width, source.height + 26]);
    page.drawPage(source, { x: 0, y: 26 });
    page.drawText(`${job.code}  |  ${i + 1} / ${embedded.length}`, { x: 16, y: 9, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
  }
  const destination = join(directory, "document.pdf");
  await writeFile(destination, await output.save()); return destination;
}
export async function convertPdfA(input: string, directory: string, signal: AbortSignal) {
  const gs = await binary("JOBS_GHOSTSCRIPT_BIN"), vera = await binary("JOBS_VERAPDF_BIN"), definition = await binary("JOBS_PDFA_DEFINITION");
  const output = join(directory, "document-pdfa.pdf");
  const icc = process.env.JOBS_PDFA_ICC ? await binary("JOBS_PDFA_ICC") : undefined;
  await run(gs, ["-dSAFER", ...(icc ? [`--permit-file-read=${icc}`] : []), "-dBATCH", "-dNOPAUSE", "-dPDFA=2", "-sDEVICE=pdfwrite", "-sColorConversionStrategy=RGB", "-dPDFACompatibilityPolicy=1", `-sOutputFile=${output}`, definition, input], signal);
  const javaArgs = process.env.JOBS_VERAPDF_JAR ? ["-jar", await binary("JOBS_VERAPDF_JAR")] : [];
  const report = await run(vera, [...javaArgs, "--format", "json", "--flavour", "2b", output], signal);
  let parsed: unknown; try { parsed = JSON.parse(report); } catch { throw new PermanentError("veraPDF não retornou um relatório JSON válido; PDF/A não certificado."); }
  await writeFile(join(directory, "verapdf.json"), report);
  if (!pdfACompliant(parsed)) throw new PermanentError("Validação veraPDF rejeitou a conformidade PDF/A-2b. Nenhum PDF/A foi disponibilizado.");
  return output;
}
export function pdfACompliant(parsed: unknown) {
  const results: boolean[] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "validationResult" && item && typeof item === "object") {
        for (const result of Array.isArray(item) ? item : [item]) {
          const r = result as Record<string, unknown> | null;
          results.push(!!r && (r.compliant === true || r.isCompliant === true) && (r.profileName === undefined || typeof r.profileName === "string" && /PDF\/A-2b/i.test(r.profileName)));
        }
      } else visit(item);
    }
  }
  visit(parsed);
  return results.length > 0 && results.every(Boolean);
}
