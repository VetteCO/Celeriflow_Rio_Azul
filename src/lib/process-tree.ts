import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attachment } from "@/db/schema";
import { moduleFile, moduleRecord } from "@/db/modules-schema";
import { canAccessDocument } from "@/lib/auth";
import { getRecord, ModuleError, scope, type Context } from "@/lib/modules/server";
import type { SourceRef } from "@/lib/jobs/types";

export type ProcessNode = SourceRef & { key: string; parent: string | null; depth: number; code: string; title: string; status: string; revision: number | null; href: string };
export type ProcessFile = { id: string; nodeKey: string; filename: string; category: string; size: number | null; sha256: string | null; createdAt: Date; downloadUrl: string };

/** Connected authorized records only. Missing access never exposes names, IDs or counts. */
export async function processTree(roots: SourceRef[], ctx: Context, includeFiles = true) {
  const queue = roots.map(ref => ({ ref, parent: null as string | null, depth: 0, required: true }));
  const visited = new Set<string>();
  const nodes: ProcessNode[] = [], files: ProcessFile[] = [];
  while (queue.length) {
    const { ref, parent, depth, required } = queue.shift()!;
    const key = `${ref.type}:${ref.id}`;
    if (visited.has(key)) continue;
    visited.add(key);
    let related: SourceRef[] = [];
    if (ref.type === "document") {
      const doc = await canAccessDocument(ctx.session, ref.id);
      if (!doc) { if (required) throw new ModuleError("Documento não encontrado.", 404); continue; }
      nodes.push({ ...ref, key, parent, depth, code: doc.businessCode ?? `${doc.number}/${doc.year}`, title: doc.subject, status: doc.status, revision: null, href: `/documentos/${ref.id}` });
      if (includeFiles) {
        const originals = await db.select().from(attachment).where(eq(attachment.documentId, ref.id)).orderBy(asc(attachment.createdAt), asc(attachment.id));
        files.push(...originals.map(f => ({ id: f.id, nodeKey: key, filename: f.filename, category: "Original do documento", size: f.size, sha256: null, createdAt: f.createdAt, downloadUrl: `/api/attachments/${f.id}` })));
      }
    } else {
      let row;
      try { row = await getRecord(ref.id, ctx); } catch (error) { if (!required && error instanceof ModuleError && error.status === 404) continue; throw error; }
      nodes.push({ ...ref, key, parent, depth, code: row.code, title: row.title, status: row.status, revision: row.revision, href: `/gestao/registros/${ref.id}` });
      related = [...(row.data.linkedIds ?? []).map(id => ({ type: "module" as const, id })), ...(row.data.coreDocumentIds ?? []).map(id => ({ type: "document" as const, id }))];
      if (includeFiles) {
        const originals = await db.select().from(moduleFile).where(eq(moduleFile.recordId, ref.id)).orderBy(asc(moduleFile.createdAt), asc(moduleFile.id));
        files.push(...originals.map(f => ({ id: f.id, nodeKey: key, filename: f.filename, category: f.category, size: f.size, sha256: f.sha256, createdAt: f.createdAt, downloadUrl: `/api/modules/records/${ref.id}/files/${f.id}` })));
      }
    }
    if (nodes.length > 100 || files.length > 2000) throw new ModuleError("O conjunto vinculado excede a consulta interativa (100 documentos ou 2.000 anexos). Utilize a exportação operacional integral.", 413);
    // Reverse links make the same process reachable from its original core document.
    const field = ref.type === "document" ? "coreDocumentIds" : "linkedIds";
    const incoming = await db.select({ id: moduleRecord.id }).from(moduleRecord).where(and(scope(ctx), sql`${moduleRecord.data}->${field} @> ${JSON.stringify([ref.id])}::jsonb`)).orderBy(asc(moduleRecord.createdAt), asc(moduleRecord.id)).limit(101);
    if (incoming.length > 100) throw new ModuleError("Há mais de 100 documentos vinculados. Utilize a exportação operacional integral.", 413);
    related.push(...incoming.map(row => ({ type: "module" as const, id: row.id })));
    queue.push(...related.map(next => ({ ref: next, parent: key, depth: depth + 1, required: false })));
  }
  return { nodes, files };
}
