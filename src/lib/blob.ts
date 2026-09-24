import { put } from "@vercel/blob";

// Anexo -> Vercel Blob. Metadados ficam em `attachment` (Neon).
export async function uploadAttachment(filename: string, body: Blob | Buffer) {
  const blob = await put(`anexos/${Date.now()}-${filename}`, body as never, {
    access: "public"
  });
  return blob.url; // salvar em attachment.storageKey
}
