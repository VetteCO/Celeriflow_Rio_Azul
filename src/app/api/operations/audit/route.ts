import { db } from "@/db";
import { actor,failure } from "@/lib/operations/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{
 await actor(req,"operations:reports");
 const f=z.object({from:z.string().datetime().optional(),to:z.string().datetime().optional(),actor:z.string().max(128).optional(),entity:z.string().max(80).optional(),page:z.coerce.number().int().min(1).max(100000).default(1),q:z.string().max(300).default(""),sort:z.enum(["time","actor","action","entity","record","metadata"]).default("time"),desc:z.enum(["true","false"]).default("true")}).refine(v=>!v.from||!v.to||Date.parse(v.from)<Date.parse(v.to),"Período inválido").parse(Object.fromEntries(new URL(req.url).searchParams));
 const column={time:"created_at",actor:"actor_id",action:"action",entity:"entity_type",record:"entity_id",metadata:"metadata"}[f.sort];
 const direction=f.desc==="true"?sql`DESC`:sql`ASC`;
 // Whitelisted identifier and parameterized values; search is literal, across all filtered records.
 const order=sql`${sql.identifier(column)} ${direction} NULLS LAST, id ${direction}`;
 const result=await db.execute(sql`WITH filtered AS (
 SELECT * FROM audit_log WHERE true
 ${f.from?sql`AND created_at>=${f.from}::timestamptz`:sql``}
 ${f.to?sql`AND created_at<${f.to}::timestamptz`:sql``}
 ${f.actor?sql`AND actor_id=${f.actor}`:sql``}
 ${f.entity?sql`AND entity_type=${f.entity}`:sql``}
 ${f.q?sql`AND strpos(lower(concat_ws(' ',created_at::text,actor_id,action,entity_type,entity_id,metadata::text)),lower(${f.q}))>0`:sql``}
 ), totals AS (SELECT count(*)::integer AS total FROM filtered), paging AS (
 SELECT total,least(${f.page},greatest(1,ceil(total/20.0)::integer)) AS page FROM totals
 ), entries AS (SELECT * FROM filtered ORDER BY ${order} LIMIT 20 OFFSET (SELECT (page-1)*20 FROM paging))
 SELECT total,page,coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at,'actorId',actor_id,'action',action,'entityType',entity_type,'entityId',entity_id,'metadata',metadata) ORDER BY ${order}) FROM entries),'[]'::jsonb) AS rows FROM paging`);
 return Response.json(result.rows[0],{headers:{"Cache-Control":"private, no-store"}});
}catch(e){return failure(e);}}
