/** Loopback-only Neon HTTP protocol adapter for an explicitly isolated PostgreSQL rehearsal. */
import { createServer } from "node:http";
import { Pool } from "pg";
const url=process.env.DATABASE_URL!, endpoint=new URL(process.env.RESTORE_SQL_ENDPOINT!);const target=new URL(url);
if(!["localhost","127.0.0.1"].includes(target.hostname)||!/(restore|ensaio|homolog)/i.test(target.pathname)||decodeURIComponent(target.pathname.slice(1))!==process.env.RESTORE_DATABASE_NAME||endpoint.hostname!=="127.0.0.1"||!endpoint.port||!/^\/[a-f0-9]{64}$/.test(endpoint.pathname))throw new Error("ISOLATED_LOOPBACK_TARGET_REQUIRED");
const pool=new Pool({connectionString:url,max:12,connectionTimeoutMillis:10000,statement_timeout:30000});
const server=createServer(async(req,res)=>{
 if(req.method!=="POST"||req.url!==endpoint.pathname||req.headers["neon-connection-string"]!==url){res.writeHead(403);res.end();return;}
 const client=await pool.connect().catch(()=>null);if(!client){res.writeHead(503);res.end();return;}
 try{let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)throw new Error("BODY_TOO_LARGE");chunks.push(chunk);}const input=JSON.parse(Buffer.concat(chunks).toString("utf8"));
 const query=async(q:{query:string;params:unknown[]})=>{const result=await client.query({text:q.query,values:q.params,rowMode:"array",types:{getTypeParser:()=>((value:string)=>value)}});return {command:result.command,rowCount:result.rowCount,rows:result.rows,fields:result.fields.map(f=>({name:f.name,dataTypeID:f.dataTypeID}))};};
 let output;if(input.queries){await client.query("BEGIN");try{if(req.headers["neon-batch-read-only"]==="true")await client.query("SET TRANSACTION READ ONLY");output={results:await Promise.all(input.queries.map(query))};await client.query("COMMIT");}catch(e){await client.query("ROLLBACK");throw e;}}else output=await query(input);
 res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(output));
 }catch(e){res.writeHead(400,{"content-type":"application/json"});res.end(JSON.stringify({message:"Isolated database query failed",code:(e as {code?:string}).code}));}finally{client.release();}
});
server.listen(Number(endpoint.port),"127.0.0.1",()=>console.log("Isolated SQL bridge ready on loopback."));
process.on("SIGTERM",()=>server.close(()=>void pool.end()));
