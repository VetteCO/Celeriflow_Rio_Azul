import { put } from "@vercel/blob";

// Anexo -> Vercel Blob. Metadados ficam em `attachment` (Neon).
// Pré-requisito: loja Blob PÚBLICA (este SDK só grava blobs públicos).
// Vercel Dashboard > Storage > Blob > Settings > Public.
export async function uploadAttachment(filename: string, body: Blob | Buffer) {
  try {
    const blob = await put(`anexos/${Date.now()}-${filename}`, body as never, {
      access: "public"
    });
    return blob.url; // salvar em attachment.storageKey
  } catch (e: unknown) {
    if (String((e as Error)?.message ?? "").includes("private store")) {
      throw new Error(
        "Blob store privada — mude para pública em Vercel Dashboard > Storage > Blob > Settings"
      );
    }
    throw e;
  }
}
