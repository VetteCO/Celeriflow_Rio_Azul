import { context, detail, failure } from "@/lib/modules/server";
import { documentPdf } from "@/lib/modules/document-pdf";
import { families, familyFields, type Family } from "@/lib/modules/domain";
import QRCode from "qrcode";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const { record, files, versions } = await detail(params.id, await context(req));
    const query = new URL(req.url).searchParams, cover = query.get("cover") === "1";
    const qr = ["oficio", "atos"].includes(record.family) ? await QRCode.toBuffer(new URL(`/gestao/registros/${record.id}`, process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).toString(), { width: 240, margin: 1 }) : undefined;
    const bytes = await documentPdf({ title: record.title, code: record.code, family: families[record.family as Family], revision: record.revision, status: record.status, createdAt: record.createdAt.toISOString(), body: record.body, blocks: record.data.blocks ?? [],
      fields: Object.entries(record.data.values ?? {}).map(([key, value]) => [familyFields[record.family as Family]?.find(f => f.key === key)?.label ?? key, value]),
      history: versions.map(v => `${v.createdAt.toISOString()} | ${v.action} | ${v.note}`), files: files.map(f => `${f.filename} | ${f.category} | SHA-256: ${f.sha256}`), qr }, cover);
    return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `${query.get("inline") === "1" ? "inline" : "attachment"}; filename="${record.code}${cover ? "-capa" : ""}.pdf"`, "cache-control": "private, no-store" } });
  } catch (e) { return failure(e); }
}
