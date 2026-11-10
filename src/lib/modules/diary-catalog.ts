import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { moduleRecord } from "@/db/modules-schema";
import { admin, getRecord, ModuleError, type Context } from "./server";
import { canManage } from "./policy";
import type { ModuleData } from "./domain";

export const diaryCatalog = pgTable("module_diary_catalog", { id:uuid("id").primaryKey(), parentId:uuid("parent_id"), kind:text("kind").notNull(), name:text("name").notNull(), position:integer("position").notNull(), active:boolean("active").notNull(), revision:integer("revision").notNull(), actorId:uuid("actor_id").notNull(), note:text("note").notNull() });
export const catalogSchema=z.object({ id:z.string().uuid().optional(), parentId:z.string().uuid().nullable(), kind:z.enum(["CADERNO","SECAO","SUBSECAO"]), name:z.string().trim().min(2).max(160), position:z.number().int().min(0).max(100000), active:z.boolean(), revision:z.number().int().min(0), note:z.string().trim().min(3).max(2000) });
export type CatalogNode=typeof diaryCatalog.$inferSelect;
export type CatalogSnapshot=Pick<CatalogNode,"id"|"parentId"|"kind"|"name"|"position"|"revision">;
export type ClassifiedAct=NonNullable<ModuleData["publication"]>[number] & { catalogPath?:CatalogSnapshot[] };
export async function listCatalog() { return db.select().from(diaryCatalog).orderBy(asc(diaryCatalog.position),asc(diaryCatalog.name),asc(diaryCatalog.id)); }
export async function saveCatalog(input:unknown,ctx:Context) {
  admin(ctx); const p=catalogSchema.parse(input); const nodes=await listCatalog();
  if(p.kind==="CADERNO" && p.parentId) throw new ModuleError("Caderno não admite pai.");
  if(p.kind!=="CADERNO") { const parent=nodes.find(n=>n.id===p.parentId); if(!parent || parent.kind!==(p.kind==="SECAO"?"CADERNO":"SECAO") || (p.active&&!parent.active)) throw new ModuleError("Selecione um pai ativo do nível imediatamente anterior."); }
  if(p.id && nodes.find(n=>n.id===p.id)?.kind!==p.kind) throw new ModuleError("O tipo de um item existente não pode ser alterado.");
  if(!p.active && nodes.some(n=>n.parentId===p.id && n.active)) throw new ModuleError("Inative os descendentes primeiro.");
  const values={...p,id:p.id??randomUUID(),revision:p.revision+1,actorId:ctx.user.id};
  const rows=p.id ? await db.update(diaryCatalog).set(values).where(and(eq(diaryCatalog.id,p.id),eq(diaryCatalog.revision,p.revision))).returning() : await db.insert(diaryCatalog).values(values).returning();
  if(!rows.length) throw new ModuleError("Catálogo alterado por outro usuário. Recarregue.",409);
  return rows[0];
}
export function catalogPath(id:string,nodes:CatalogNode[]):CatalogSnapshot[] {
  const path:CatalogSnapshot[]=[]; const seen=new Set<string>(); let current:string|null=id;
  while(current) { const node=nodes.find(n=>n.id===current); if(!node || !node.active || seen.has(current)) throw new ModuleError("Classificação inexistente, inativa ou cíclica."); seen.add(current); path.unshift({id:node.id,parentId:node.parentId,kind:node.kind,name:node.name,position:node.position,revision:node.revision}); current=node.parentId; }
  if(path.length>3 || path.some((n,i)=>n.kind!==["CADERNO","SECAO","SUBSECAO"][i])) throw new ModuleError("Estrutura do catálogo inválida.");
  return path;
}
export function classifyAct(act:ClassifiedAct,path:CatalogSnapshot[]):ClassifiedAct {
  // Existing public renderers consume section/subsection; include the notebook in section.
  return {...act,catalogPath:path,section:path.slice(0,2).map(n=>n.name).join(" / "),subsection:path[2]?.name??""};
}
export async function validatePublication(publication:ClassifiedAct[]) {
  const nodes=await listCatalog();
  for(const act of publication.filter(a=>!a.withdrawn)) {
    const saved=act.catalogPath; if(!saved?.length) throw new ModuleError("Classifique todos os atos em Diário → Catálogo e organização antes de publicar.");
    const current=catalogPath(saved[saved.length-1].id,nodes);
    if(current.length!==saved.length || current.some((node,i)=>Object.entries(node).some(([key,value])=>saved[i][key as keyof CatalogSnapshot]!==value))) throw new ModuleError("O catálogo mudou. Reclassifique os atos para atualizar seus snapshots antes de publicar.",409);
    const expected=classifyAct(act,current);
    if(expected.section!==act.section || expected.subsection!==(act.subsection??"")) throw new ModuleError("Rótulos divergentes do catálogo. Reclassifique o ato.");
  }
}
const organizeSchema=z.object({ revision:z.number().int().positive(), note:z.string().trim().min(3).max(2000), items:z.array(z.object({ id:z.string().uuid(), catalogId:z.string().uuid(), withdrawn:z.boolean() })).min(1).max(100) });
export async function organizeEdition(id:string,input:unknown,ctx:Context) {
  const p=organizeSchema.parse(input), row=await getRecord(id,ctx);
  if(row.family!=="diario" || !["RASCUNHO","AGUARDANDO_ASSINATURA"].includes(row.status)) throw new ModuleError("Organização permitida apenas antes da publicação.");
  if(!canManage(row,ctx)) throw new ModuleError("Sem permissão para organizar esta edição.",403);
  const acts=(row.data.publication??[]) as ClassifiedAct[];
  if(new Set(p.items.map(i=>i.id)).size!==acts.length || p.items.length!==acts.length || p.items.some(i=>!acts.some(a=>a.id===i.id))) throw new ModuleError("Preserve todos os atos: use retirada para suprimir um ato da edição.");
  const nodes=await listCatalog();
  const publication=p.items.map(i=>classifyAct({...acts.find(a=>a.id===i.id)!,withdrawn:i.withdrawn},catalogPath(i.catalogId,nodes)));
  const data={...row.data,publication,sealedHash:createHash("sha256").update(JSON.stringify(publication)).digest("hex"),signatures:[]};
  const [updated]=await db.update(moduleRecord).set({data,revision:p.revision+1,actorId:ctx.user.id,externalActorUid:null,action:"ORGANIZAR_CATALOGO",note:p.note}).where(and(eq(moduleRecord.id,id),eq(moduleRecord.revision,p.revision))).returning();
  if(!updated) throw new ModuleError("Edição alterada por outro usuário. Recarregue.",409);
  return updated;
}
