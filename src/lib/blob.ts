import { get, put } from "@vercel/blob";

// Anexo -> Vercel Blob em LOJA PRIVADA (SDK v2). Metadados em `attachment`.
// storageKey guarda o PATHNAME; o download passa por /api/attachments/[id]
// (com autenticação + RBAC), nunca por link público direto — melhor p/ LGPD.
function token() {
  // Normaliza: alguns loaders de .env mantêm aspas literais no valor.
  return (process.env.BLOB_READ_WRITE_TOKEN ?? "").trim().replace(/^"|"$/g, "");
}

export async function uploadAttachment(filename: string, body: Blob | Buffer) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = await put(`anexos/${Date.now()}-${safe}`, body as never, {
    access: "private",
    token: token(),
  });
  return blob.pathname;
}

export async function downloadAttachment(pathname: string) {
  const res = await get(pathname, { access: "private", token: token() });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return {
    stream: res.stream,
    contentType: res.blob.contentType || "application/octet-stream",
    size: res.blob.size,
  };
}
