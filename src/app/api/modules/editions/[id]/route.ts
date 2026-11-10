import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { moduleRecord } from "@/db/modules-schema";
import { failure, ModuleError } from "@/lib/modules/server";
import { textPdf } from "@/lib/modules/formats";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const [row] = await db.select().from(moduleRecord).where(and(eq(moduleRecord.id, params.id), eq(moduleRecord.family, "diario"), eq(moduleRecord.status, "PUBLICADO"), eq(moduleRecord.access, "PUBLICO")));
    if (!row?.data.publication?.length || !row.data.publishedAt) throw new ModuleError("Edição não encontrada.", 404);
    const lines = [`Edição ${row.code}`, `Publicada em ${new Date(row.data.publishedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, "Publicação informativa, sem assinatura digital. Este PDF é uma representação textual dos atos publicados.", ""];
    for (const act of row.data.publication.filter(a=>!a.withdrawn)) {
      lines.push(`${act.section} / ${act.subsection ?? ""} | ${act.code} | ${act.title}`, act.body);
      for (const b of act.blocks ?? []) lines.push(b.type === "paragraph" ? b.text : b.type === "table" ? b.rows.map(r => r.join(" | ")).join("\n") : b.type === "link" ? `${b.label}: ${b.url}` : `${b.caption}: ${b.url.startsWith("data:") ? "Imagem incorporada disponível na leitura digital" : b.url}`);
      lines.push("");
    }
    return new Response(textPdf(row.title, lines), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="edicao-${row.code}.pdf"` } });
  } catch (e) { return failure(e); }
}
