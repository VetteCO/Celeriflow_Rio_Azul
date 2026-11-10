import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { admin, context, getRecord, command, failure, ModuleError } from "@/lib/modules/server";
export const dynamic="force-dynamic";
export async function POST(req:Request) {
 try {
  const ctx=await context(req,"doc:edit");admin(ctx);const input=await req.json();
  if(input.action==="IMPORT") {
   const nodes=z.array(z.object({key:z.string().min(1).max(80),parent:z.string().max(80).optional(),title:z.string().min(3).max(250),description:z.string().max(10000).default("")})).min(1).max(1000).parse(input.nodes);
   const map=new Map(nodes.map(n=>[n.key,{...n,id:randomUUID()}]));if(map.size!==nodes.length)throw new ModuleError("Chaves duplicadas.");
   for(const n of nodes){const seen=new Set([n.key]);let parent=n.parent;while(parent){if(seen.has(parent))throw new ModuleError("Hierarquia circular.");seen.add(parent);const ancestor=map.get(parent);if(!ancestor)throw new ModuleError(`Pai inexistente: ${parent}`);parent=ancestor.parent;}}
   const records=[...map.values()].map(n=>({id:n.id,title:n.title,body:n.description,data:{values:{hierarchyKey:n.key,parentId:n.parent?map.get(n.parent)!.id:""}}}));
   await db.execute(sql`INSERT INTO module_record(id,family,title,body,status,owner_id,actor_id,data)
    SELECT (v->>'id')::uuid,'classificacao',v->>'title',v->>'body','ATIVO',${ctx.user.id}::uuid,${ctx.user.id}::uuid,v->'data' FROM jsonb_array_elements(${JSON.stringify(records)}::jsonb) v`);
   return Response.json({imported:records.length});
  }
  const p=z.object({classificationId:z.string().uuid(),records:z.array(z.object({id:z.string().uuid(),revision:z.number().int().positive()})).min(1).max(100),note:z.string().trim().min(3).max(1000)}).parse(input);
  const results=[];
  for(const target of p.records){try{await getRecord(target.id,ctx);await command(target.id,{revision:target.revision,action:"CLASSIFICAR",payload:{classificationId:p.classificationId},note:p.note},ctx);results.push({id:target.id,saved:true});}catch(e){results.push({id:target.id,saved:false,error:(e as Error).message});}}
  return Response.json({results});
 }catch(e){return failure(e);}
}
