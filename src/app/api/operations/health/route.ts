import { db } from "@/db";
import { sql } from "drizzle-orm";
import { actor,failure } from "@/lib/operations/server";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{await actor(req,"operations:manage");const started=Date.now();await db.execute(sql`SELECT 1`);return Response.json({database:"reachable",latencyMs:Date.now()-started,checkedAt:new Date().toISOString(),availabilityPercent:null,redundancyVerified:false,restoreVerified:false},{headers:{"Cache-Control":"no-store"}});}catch(e){return failure(e);}}
