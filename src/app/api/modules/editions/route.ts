import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { moduleRecord } from "@/db/modules-schema";
import { failure } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const url = new URL(req.url); const query = (url.searchParams.get("q") ?? "").trim().toLocaleLowerCase("pt-BR"); const month = url.searchParams.get("month");
    const rows = await db.select().from(moduleRecord).where(and(eq(moduleRecord.family, "diario"), eq(moduleRecord.status, "PUBLICADO"), eq(moduleRecord.access, "PUBLICO"))).orderBy(desc(moduleRecord.updatedAt));
    const publications = rows.map(r=>({...r,data:{...r.data,publication:r.data.publication?.filter(a=>!a.withdrawn).map(a=>({...a,section:[a.section,a.subsection].filter(Boolean).join(" / ")}))}})).filter(r => !!r.data.publishedAt && !!r.data.publication?.length);
    const days = Object.fromEntries(publications.reduce((map, row) => { const day = new Date(row.data.publishedAt!).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); map.set(day, (map.get(day) ?? 0) + 1); return map; }, new Map<string, number>()));
    const editions = publications.filter(r => !month || new Date(r.data.publishedAt!).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).startsWith(month)).filter(r => !query || `${r.code} ${r.title} ${JSON.stringify(r.data.publication)}`.toLocaleLowerCase("pt-BR").includes(query)).map(r => ({ id: r.id, code: r.code, title: r.title, publishedAt: r.data.publishedAt, type: r.data.values?.tipo, publicationMode: r.data.publicationMode ?? "INFORMATIVA", count: r.data.publication!.length, acts: r.data.publication!.map(a => ({ ...a, matches: query ? `${a.title} ${a.body} ${JSON.stringify(a.blocks ?? [])}`.toLocaleLowerCase("pt-BR").split(query).length - 1 : 0 })), hash: r.data.sealedHash }));
    return Response.json({ editions, days });
  } catch (e) { return failure(e); }
}
