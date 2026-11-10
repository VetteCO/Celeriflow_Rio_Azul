import { context, detail, failure } from "@/lib/modules/server";
import { textPdf } from "@/lib/modules/formats";
import { families, familyFields, type Family } from "@/lib/modules/domain";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts } from "pdf-lib";
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
    let bytes: Uint8Array = textPdf(record.title, lines);
    if (record.family === "oficio") {
      const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const url = new URL(`/gestao/registros/${record.id}`, base).toString();
      const pdf = await PDFDocument.load(bytes), font = await pdf.embedFont(StandardFonts.Helvetica);
      const image = await pdf.embedPng(await QRCode.toBuffer(url, { width: 240, margin: 1 }));
      const page = pdf.getPages()[0];
      page.drawImage(image, { x: 465, y: 45, width: 80, height: 80 });
      page.drawText("Consulta digital: acesso institucional autorizado.", { x: 40, y: 96, size: 8, font });
      page.drawText("O QR nao comprova entrega, ciencia ou assinatura digital.", { x: 40, y: 82, size: 8, font });
      bytes = await pdf.save();
    }
    return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${record.code}${cover ? "-capa" : ""}.pdf"`, "cache-control": "private, no-store" } });
  } catch (e) { return failure(e); }
}
