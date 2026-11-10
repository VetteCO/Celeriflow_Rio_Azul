import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { and, eq, sql } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { db } from "@/db";
import { attachment } from "@/db/schema";
import { moduleFile } from "@/db/modules-schema";
import { documentJob, type DocumentJob } from "@/db/jobs-schema";
import { downloadAttachment } from "@/lib/blob";
import { authorizeSources, userContext, audit } from "./server";
import { blobToken, claim, cleanup, fail, heartbeat } from "./queue";
import { binary, run } from "./commands";
import { ConfigurationError, PermanentError, type JobFile } from "./types";
import { convertPdfA, documentHtml, renderPdf } from "./render";
import { writeZip } from "./zip";

type LocalFile = { file: JobFile; path: string; sha256: string; size: number };
const MAX_FILE = 128 * 1024 * 1024;
async function downloadFiles(job: DocumentJob, directory: string, signal: AbortSignal) {
  const files: LocalFile[] = []; let total = 0;
  for (const file of job.payload.files) {
    signal.throwIfAborted();
    const source = job.payload.sources.find(s => s.id === file.sourceId)!;
    // Deleted/replaced attachments must not be resurrected from the captured storage key.
    const [current] = source.type === "document"
      ? await db.select({ storageKey: attachment.storageKey }).from(attachment).where(and(eq(attachment.id, file.id), eq(attachment.documentId, source.id)))
      : await db.select({ storageKey: moduleFile.storageKey }).from(moduleFile).where(and(eq(moduleFile.id, file.id), eq(moduleFile.recordId, source.id)));
    if (!current || current.storageKey !== file.storageKey) throw new PermanentError("Anexo removido ou substituído após a solicitação. Crie uma nova seleção.");
    const response = await downloadAttachment(file.storageKey);
    if (!response) throw new PermanentError("Original indisponível no armazenamento privado.");
    const path = join(directory, file.id); const hash = createHash("sha256"); let size = 0;
    const meter = new Transform({ transform(chunk: Buffer, _encoding, done) {
      size += chunk.length; total += chunk.length;
      if (size > MAX_FILE || total > (job.kind === "ZIP" ? 1_800_000_000 : 256 * 1024 * 1024)) return done(new PermanentError("Seleção excede o limite do executor (128 MiB por anexo; 256 MiB para PDF/OCR ou 1,8 GB para ZIP)."));
      hash.update(chunk); done(null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.stream as Parameters<typeof Readable.fromWeb>[0]), meter, createWriteStream(path, { flags: "wx", mode: 0o600 }), { signal });
    const sha256 = hash.digest("hex");
    if (file.sha256 && file.sha256 !== sha256) throw new PermanentError("Hash do original diverge do cadastro; processamento interrompido.");
    if (file.size !== null && file.size !== size) throw new PermanentError("Tamanho do original diverge do cadastro.");
    files.push({ file, path, sha256, size });
  }
  return files;
}
async function extract(files: LocalFile[], directory: string, signal: AbortSignal) {
  const results: { fileId: string; sourceId: string; filename: string; text: string }[] = [];
  let total = 0;
  for (const { file, path } of files) {
    signal.throwIfAborted(); let text = "";
    if (file.mimeType === "application/pdf") {
      const textPath = join(directory, `${file.id}.txt`);
      await run(await binary("JOBS_PDFTOTEXT_BIN"), ["-enc", "UTF-8", "-layout", path, textPath], signal);
      if ((await stat(textPath)).size > 5 * 1024 * 1024) throw new PermanentError("Texto extraído excede 5 MiB.");
      text = await readFile(textPath, "utf8");
      // OCR every rendered page, including hybrid PDFs whose other pages already contain text.
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.load(await readFile(path));
      if (pdf.getPageCount() > 200) throw new PermanentError("OCR limitado a 200 páginas por anexo.");
      const raster = await binary("JOBS_PDFTOPPM_BIN"), tesseract = await binary("JOBS_TESSERACT_BIN");
      const recognized: string[] = [];
      for (let page = 1; page <= pdf.getPageCount(); page++) {
        const prefix = join(directory, `${file.id}-page`);
        await run(raster, ["-f", String(page), "-l", String(page), "-singlefile", "-scale-to", "3000", "-png", path, prefix], signal);
        recognized.push(await run(tesseract, [`${prefix}.png`, "stdout", "-l", process.env.JOBS_OCR_LANG ?? "por", "--psm", "3"], signal));
        await rm(`${prefix}.png`, { force: true });
        if (recognized.reduce((n, t) => n + t.length, 0) > 5 * 1024 * 1024) throw new PermanentError("Texto OCR excede 5 MiB.");
      }
      text = `TEXTO INCORPORADO\n${text}\n\nRECONHECIMENTO ÓPTICO POR PÁGINA\n${recognized.join("\n\f\n")}`;
    } else if (["image/png", "image/jpeg", "image/tiff", "image/bmp"].includes(file.mimeType)) {
      text = await run(await binary("JOBS_TESSERACT_BIN"), [path, "stdout", "-l", process.env.JOBS_OCR_LANG ?? "por", "--psm", "3"], signal);
    } else throw new PermanentError(`Formato de ${file.filename} incompatível com OCR. Selecione PDF, PNG, JPEG, TIFF ou BMP.`);
    total += Buffer.byteLength(text);
    if (total > 10 * 1024 * 1024) throw new PermanentError("Índice textual da seleção excede 10 MiB.");
    results.push({ fileId: file.id, sourceId: file.sourceId, filename: file.filename, text: text.replace(/\u0000/g, "") });
  }
  return results;
}
async function hashFile(path: string) {
  const hash = createHash("sha256"); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest("hex");
}
export async function processJob(job: DocumentJob) {
  const directory = await mkdtemp(join(process.env.JOBS_TEMP_DIR ?? tmpdir(), "celeriflow-job-"));
  const controller = new AbortController(); let renewing = false; let uploaded: string | undefined;
  const pulse = setInterval(() => {
    if (renewing) return; renewing = true;
    void heartbeat(job).then(ok => { if (!ok) controller.abort(); }).catch(() => controller.abort()).finally(() => { renewing = false; });
  }, 30000);
  const timeout = setTimeout(() => controller.abort(), 60 * 60 * 1000);
  try {
    if (!blobToken()) throw new ConfigurationError("Configure BLOB_READ_WRITE_TOKEN para a loja privada no worker.");
    await authorizeSources(job.payload.sources, await userContext(job.ownerId));
    const files = await downloadFiles(job, directory, controller.signal);
    let output: string, contentType: string, extension: string;
    let validation: Record<string, unknown> | null = null;
    let texts: Awaited<ReturnType<typeof extract>> = [];
    if (job.kind === "ZIP") {
      const manifest = { job: job.code, capturedAt: job.payload.capturedAt, selection: job.payload.selection,
        sources: job.payload.sources.map(({ id, type, code, title, revision }) => ({ id, type, code, title, revision })),
        files: files.map(({ file, sha256, size }) => ({ id: file.id, sourceId: file.sourceId, filename: file.filename, mimeType: file.mimeType, sha256, size, path: `originais/${file.sourceId}/${file.id}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)}` })) };
      const manifestPath = join(directory, "manifest.json"), htmlPath = join(directory, "conteudo.html");
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2)); await writeFile(htmlPath, documentHtml(job));
      output = join(directory, "originais.zip"); extension = "zip"; contentType = "application/zip";
      await writeZip(output, [{ name: "manifesto.json", path: manifestPath }, { name: "conteudo.html", path: htmlPath }, ...files.map((f, i) => ({ name: manifest.files[i].path, path: f.path }))], controller.signal);
    } else if (job.kind === "OCR") {
      texts = await extract(files, directory, controller.signal); output = join(directory, "texto.json"); extension = "json"; contentType = "application/json";
      await writeFile(output, JSON.stringify({ code: job.code, files: texts }, null, 2));
    } else {
      output = await renderPdf(job, files, directory, controller.signal); extension = "pdf"; contentType = "application/pdf";
      if (job.kind === "PDFA") {
        output = await convertPdfA(output, directory, controller.signal);
        validation = { profile: "PDF/A-2b", validator: "veraPDF", validatedAt: new Date().toISOString(), report: JSON.parse(await readFile(join(directory, "verapdf.json"), "utf8")) };
      }
    }
    controller.signal.throwIfAborted();
    await authorizeSources(job.payload.sources, await userContext(job.ownerId));
    const outputHash = await hashFile(output), size = (await stat(output)).size;
    if (validation) validation.outputSha256 = outputHash;
    if (size > 2_000_000_000) throw new PermanentError("Artefato excede o limite de 2 GB.");
    const ttl = Number(process.env.JOBS_OUTPUT_TTL_HOURS ?? "24");
    if (!Number.isFinite(ttl) || ttl < 1 || ttl > 168) throw new ConfigurationError("JOBS_OUTPUT_TTL_HOURS deve estar entre 1 e 168 horas.");
    const expires = new Date(Date.now() + ttl * 3600000);
    const key = `processamento/${job.id}/${job.leaseToken}.${extension}`;
    await db.execute(sql`INSERT INTO document_job_blob(pathname,job_id,expires_at) VALUES(${key},${job.id}::uuid,${expires.toISOString()}::timestamptz) ON CONFLICT(pathname) DO NOTHING`);
    const blob = await put(key, createReadStream(output), { access: "private", token: blobToken(), addRandomSuffix: false, contentType, multipart: size > 8 * 1024 * 1024, abortSignal: controller.signal });
    uploaded = blob.pathname;
    controller.signal.throwIfAborted();
    // A fenced CTE publishes the output and OCR index together. Stale workers cannot commit after reclaim.
    const result = await db.execute(sql`WITH finished AS (
      UPDATE document_job SET status='SUCCEEDED',output_key=${blob.pathname},output_type=${contentType},output_hash=${outputHash},output_size=${size},
        output_name=${`${job.code}${job.kind === "PDFA" ? "-PDFA-2b" : ""}.${extension}`},expires_at=${expires.toISOString()}::timestamptz,
        validation=${validation ? JSON.stringify(validation) : null}::jsonb,updated_at=now(),lease_token=NULL,lease_until=NULL,error=NULL
      WHERE id=${job.id}::uuid AND lease_token=${job.leaseToken}::uuid AND status='RUNNING' AND lease_until>now() RETURNING id
    ), indexed AS (
      INSERT INTO document_job_text(job_id,file_id,source_id,text)
      SELECT finished.id,(x->>'fileId')::uuid,(x->>'sourceId')::uuid,x->>'text' FROM finished,
        jsonb_array_elements(${JSON.stringify(texts)}::jsonb) x RETURNING id
    ) SELECT id FROM finished`);
    if (!result.rows.length) throw new Error("Lease perdido antes da publicação.");
    uploaded = undefined;
    await audit(job.ownerId, "JOB_COMPLETED", job.id, { kind: job.kind, sha256: outputHash, size });
  } catch (error) {
    console.error(`[jobs ${job.id}]`, error);
    if (uploaded) { try { await del(uploaded, { token: blobToken() }); } catch { /* TTL ledger retries deletion. */ } }
    await fail(job, error);
  } finally { clearInterval(pulse); clearTimeout(timeout); controller.abort(); await rm(directory, { recursive: true, force: true }); }
}
export async function workerTick() { await cleanup(); const job = await claim(); if (job) await processJob(job); return !!job; }
