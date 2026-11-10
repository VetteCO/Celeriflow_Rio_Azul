import { context, detail, failure } from "@/lib/modules/server";
import { textPdf } from "@/lib/modules/formats";
import { families, familyFields, type Family } from "@/lib/modules/domain";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const { record, files, versions } = await detail(params.id, await context(req));
    const cover = new URL(req.url).searchParams.get("cover") === "1";
    const lines = [families[record.family as Family], `Código: ${record.code} | Revisão: ${record.revision}`, `Situação: ${record.status}`, `Criado em: ${record.createdAt.toISOString()}`, "Documento sem assinatura digital.", ""];
    if (!cover) {
      lines.push(record.body, "", ...Object.entries(record.data.values ?? {}).map(([key, value]) => `${familyFields[record.family as Family]?.find(f => f.key === key)?.label ?? key}: ${value}`));
      for (const block of record.data.blocks ?? []) lines.push(block.type === "paragraph" ? block.text : block.type === "table" ? block.rows.map(row => row.join(" | ")).join("\n") : block.type === "link" ? `${block.label}: ${block.url}` : `Imagem: ${block.caption} (${block.url.startsWith("data:") ? "Imagem incorporada disponível na leitura digital" : block.url})`);
      lines.push("", "Histórico", ...versions.map(v => `${v.createdAt.toISOString()} | ${v.action} | ${v.note}`));
      lines.push("", "Relação de anexos (originais disponíveis separadamente)", ...files.map(f => `${f.filename} | ${f.category} | SHA-256: ${f.sha256}`));
    }
    return new Response(textPdf(record.title, lines), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${record.code}${cover ? "-capa" : ""}.pdf"`, "cache-control": "private, no-store" } });
  } catch (e) { return failure(e); }
}
