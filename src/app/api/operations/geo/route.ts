import {db} from "@/db";
import {sql} from "drizzle-orm";
import {actor,failure,OperationError} from "@/lib/operations/server";
import {geographicParts,type OperationFeature} from "@/lib/operations/geo";
import {z} from "zod";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{
 await actor(req,"operations:reports");
 const f=z.object({family:z.enum(["camadas","fiscalizacao"]).optional(),code:z.string().max(13).optional(),department:z.string().uuid().optional()}).parse(Object.fromEntries(new URL(req.url).searchParams));
 const exists=await db.execute(sql`SELECT to_regclass('public.module_record') IS NOT NULL AS ready`);
 if(!exists.rows[0]?.ready)throw new OperationError(409,"As fontes territoriais ainda não foram implantadas.");
 const result=await db.execute(sql`SELECT id,code,family,data->'geometry' AS geometry,data->'values'->>'latitude' AS latitude,data->'values'->>'longitude' AS longitude FROM module_record WHERE family IN ('camadas','fiscalizacao') ${f.family?sql`AND family=${f.family}`:sql``} ${f.code?sql`AND code=${f.code}`:sql``} ${f.department?sql`AND department_id=${f.department}::uuid`:sql``} ORDER BY code,id LIMIT 1001`);
 if(result.rows.length>1000)throw new OperationError(413,"Mais de 1.000 registros territoriais. Refine os filtros para desenhar o mapa completo do recorte.");
 const features:OperationFeature[]=[];let invalid=0,vertices=0;
 function add(id:string,code:string,family:string,type:string,coordinates:unknown){const parts=geographicParts(type,coordinates);if(!parts){invalid++;return;}vertices+=parts.reduce((n,p)=>n+p.length,0);if(vertices>50000)throw new OperationError(413,"O recorte ultrapassa 50.000 vértices. Filtre uma camada ou um registro.");features.push({id,code,family,type:type as OperationFeature["type"],parts});}
 for(const row of result.rows){
  const id=String(row.id),code=String(row.code),family=String(row.family);
  if(family==="fiscalizacao"){
   if(row.latitude===null||row.longitude===null||String(row.latitude).trim()===""||String(row.longitude).trim()===""){invalid++;continue;}
   add(id,code,family,"Point",[Number(row.longitude),Number(row.latitude)]);
  }else{
   const geometry=row.geometry as {type?:string;features?:{geometry?:{type?:string;coordinates?:unknown}}[]}|null;
   if(geometry?.type!=="FeatureCollection"||!Array.isArray(geometry.features)){invalid++;continue;}
   geometry.features.forEach((feature,i)=>add(`${id}:${i}`,code,family,feature.geometry?.type??"",feature.geometry?.coordinates));
  }
 }
 return Response.json({features,records:result.rows.length,invalid,vertices,crs:"EPSG:4326",generatedAt:new Date().toISOString()},{headers:{"Cache-Control":"private, no-store"}});
}catch(e){return failure(e);}}
