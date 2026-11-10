import { Client,neonConfig } from '@neondatabase/serverless';
import { report,reportFilters } from './reports';
import { historicalReports } from './historical-reports';
import { inSnapshot } from './query';
import type { z } from 'zod';
neonConfig.webSocketConstructor=globalThis.WebSocket;
export async function consistentReport(filters:z.infer<typeof reportFilters>){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada');const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
 try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const rows=await inSnapshot((text,values)=>client.query(text,values),async()=>[...await report(filters),...await historicalReports(filters)]);await client.query('COMMIT');return rows;}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{await client.end();}
}
