import {db} from '@/db';
import {sql} from 'drizzle-orm';
import {actor,failure,OperationError} from '@/lib/operations/server';
import {geographicParts,type OperationFeature} from '@/lib/operations/geo';
import {ageBand,FINAL_STATES} from '@/lib/operations/snapshot-helpers';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 await actor(req,'operations:reports');const f=z.object({family:z.string().max(80).optional(),code:z.string().max(13).optional(),department:z.string().uuid().optional(),from:z.string().date().optional(),to:z.string().date().optional(),workflow:z.string().uuid().optional(),state:z.enum(['OPEN','CLOSED']).optional(),band:z.enum(['ABERTO_ATE20','ABERTO_20A30','ABERTO_MAIS30','RESOLVIDO_ATE30','RESOLVIDO_MAIS30','SEM_DATA']).optional()}).parse(Object.fromEntries(new URL(req.url).searchParams));
 if(f.from&&f.to&&f.from>f.to)throw new OperationError(400,'Período inválido');const cutoff=new Date(Math.min(f.to?Date.parse(f.to)+86400000:Date.now(),Date.now())).toISOString();
 const result=await db.execute(sql`SELECT m.id,m.code,m.family,m.created_at,v.snapshot->>'status' status,v.snapshot->'data'->>'workflowId' subject,v.snapshot->'data'->'geometry' geometry,v.snapshot->'data'->'values'->>'latitude' latitude,v.snapshot->'data'->'values'->>'longitude' longitude,
 (SELECT max(cv.created_at) FROM module_version cv LEFT JOIN module_version prev ON prev.record_id=cv.record_id AND prev.revision=cv.revision-1 WHERE cv.record_id=m.id AND cv.created_at<${cutoff}::timestamptz AND cv.snapshot->>'status' IN('CONCLUIDO','ARQUIVADO','DEFERIDO','INDEFERIDO','PUBLICADO','CIENTE') AND coalesce(prev.snapshot->>'status','') NOT IN('CONCLUIDO','ARQUIVADO','DEFERIDO','INDEFERIDO','PUBLICADO','CIENTE')) closed_at
 FROM module_record m JOIN LATERAL(SELECT snapshot FROM module_version WHERE record_id=m.id AND created_at<${cutoff}::timestamptz ORDER BY revision DESC LIMIT 1)v ON true
 WHERE (m.family='camadas' OR v.snapshot->'data'->'values' ? 'latitude' OR v.snapshot->'data'->'values' ? 'longitude') AND m.created_at<${cutoff}::timestamptz ${f.from?sql`AND m.created_at>=${f.from}::date`:sql``} ${f.family?sql`AND m.family=${f.family}`:sql``} ${f.code?sql`AND m.code=${f.code}`:sql``} ${f.department?sql`AND v.snapshot->>'department_id'=${f.department}`:sql``} ${f.workflow?sql`AND v.snapshot->'data'->>'workflowId'=${f.workflow}`:sql``} ORDER BY m.code,m.id LIMIT 1001`);
 if(result.rows.length>1000)throw new OperationError(413,'Mais de 1.000 registros; refine período/setor/família para representar o recorte completo.');
 const features:OperationFeature[]=[];let invalid=0,vertices=0,records=0;const bands:Record<string,number>={};
 for(const row of result.rows){const closed=FINAL_STATES.has(String(row.status));if(f.state&&(f.state==='CLOSED')!==closed)continue;const created=new Date(String(row.created_at)).toISOString();const band=closed&&!row.closed_at?'SEM_DATA':ageBand(created,cutoff,closed?new Date(String(row.closed_at)).toISOString():null);if(f.band&&f.band!==band)continue;records++;if(row.family!=='camadas')bands[band]=(bands[band]||0)+1;
 const subject=z.string().uuid().safeParse(row.subject);const meta={status:String(row.status),band,subject:subject.success?subject.data:'SEM_WORKFLOW',createdAt:created};
 const add=(id:string,type:string,coordinates:unknown)=>{const parts=geographicParts(type,coordinates);if(!parts){invalid++;return;}vertices+=parts.reduce((n,p)=>n+p.length,0);if(vertices>50000)throw new OperationError(413,'Recorte excede 50.000 vértices.');features.push({id,code:String(row.code),family:String(row.family),type:type as OperationFeature['type'],parts,...meta});};
 if(row.family!=='camadas'){if(row.latitude===null||row.longitude===null||String(row.latitude).trim()===''||String(row.longitude).trim()===''){invalid++;continue;}add(String(row.id),'Point',[Number(row.longitude),Number(row.latitude)]);}
 else{const geometry=row.geometry as {features?:{geometry?:{type?:string;coordinates?:unknown}}[]}|null;if(!Array.isArray(geometry?.features)){invalid++;continue;}geometry.features.forEach((feature,i)=>add(`${row.id}:${i}`,feature.geometry?.type||'',feature.geometry?.coordinates));}}
 const total=Object.values(bands).reduce((a,b)=>a+b,0);return Response.json({features,records,invalid,vertices,bands:Object.entries(bands).map(([band,count])=>({band,count,percent:total?100*count/total:null})),cutoff,crs:'EPSG:4326'},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return failure(e);}}
