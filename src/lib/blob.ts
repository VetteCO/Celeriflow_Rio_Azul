import { get, put } from "@vercel/blob";
import { ownDownloadStream } from "./blob-stream";
import { restoreRuntime } from "./restore-runtime";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

// Anexo -> Vercel Blob em LOJA PRIVADA (SDK v2). Metadados em `attachment`.
// storageKey guarda o PATHNAME; o download passa por /api/attachments/[id]
// (com autenticação + RBAC), nunca por link público direto — melhor p/ LGPD.
function token() {
  // Normaliza: alguns loaders de .env mantêm aspas literais no valor.
  return (process.env.BLOB_READ_WRITE_TOKEN ?? "").trim().replace(/^"|"$/g, "");
}

export async function uploadAttachment(filename: string, body: Blob | Buffer) {
  if (restoreRuntime()) {
    const name = `${randomUUID()}.bin`; const folder=join(process.env.RESTORE_STORAGE_ROOT!,"originals"); await mkdir(folder,{recursive:true});
    await writeFile(join(folder,name),Buffer.isBuffer(body)?body:Buffer.from(await body.arrayBuffer()),{flag:"wx"});return `restore/${name}`;
  }
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = await put(`anexos/${Date.now()}-${safe}`, body as never, {
    access: "private",
    token: token(),
  });
  return blob.pathname;
}

export async function downloadAttachment(pathname: string) {
  if (restoreRuntime()) {
    if (!/^restore\/[a-zA-Z0-9-]+\.bin$/.test(pathname)) return null;
    const path=join(process.env.RESTORE_STORAGE_ROOT!,"originals",pathname.slice(8));
    try {const file=await stat(path);return {stream:Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,contentType:"application/octet-stream",size:file.size};}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw e;}
  }
  const res = await get(pathname, { access: "private", token: token() });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return {
    stream: ownDownloadStream(res.stream),
    contentType: res.blob.contentType || "application/octet-stream",
    size: res.blob.size,
  };
}
