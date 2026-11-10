import { Client,neonConfig } from '@neondatabase/serverless';
import { PDFDocument } from 'pdf-lib';
import { downloadAttachment } from '@/lib/blob';
import { createWriteStream } from 'node:fs';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable,Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
neonConfig.webSocketConstructor=globalThis.WebSocket;
export async function measurePages(selection?:{kind:'attachment'|'module_file'|'document_job';id:string}[]){
 if(selection&&(!selection.length||selection.some(s=>!['attachment','module_file','document_job'].includes(s.kind)||!/^[0-9a-f-]{36}$/i.test(s.id))))throw new Error('Seleção de fontes inválida');
 const selected=selection?` AND (s.kind,s.id) IN (${selection.map(s=>`('${s.kind}','${s.id}'::uuid)`).join(',')})`:'';
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada');
 if(new URL(process.env.DATABASE_URL).hostname.includes('-pooler'))throw new Error('Catálogo exige DATABASE_URL direta (sem pooler transacional), para manter o cursor entre lotes.');
 const limit=Number(process.env.OPERATIONS_PDF_MAX_BYTES||536870912);if(!Number.isSafeInteger(limit)||limit<1)throw new Error('Limite de memória PDF inválido');
 const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();let measured=0;try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
 await client.query(`DECLARE page_sources NO SCROLL CURSOR WITH HOLD FOR WITH sources AS(
 SELECT 'attachment' kind,id,storage_key,coalesce(mime_type,'') mime,'' source_hash,filename FROM attachment
 UNION ALL SELECT 'module_file',id,storage_key,mime_type,sha256,filename FROM module_file
 UNION ALL SELECT 'document_job',id,output_key,coalesce(output_type,''),coalesce(output_hash,''),output_name FROM document_job WHERE status='SUCCEEDED' AND output_key IS NOT NULL)
 SELECT s.* FROM sources s WHERE NOT EXISTS(SELECT 1 FROM operation_page_metric p WHERE p.source_type=s.kind AND p.source_id=s.id AND p.storage_key=s.storage_key AND p.source_hash=s.source_hash ${process.argv.includes('--retry-unknown')?"AND p.status='KNOWN'":''})${selected}`);
 await client.query('COMMIT');
 while(true){const batch=await client.query('FETCH FORWARD 25 FROM page_sources');if(!batch.rows.length)break;
 for(const row of batch.rows){let pages:number|null=null,bytes=0,hash:string|null=null,status='UNREADABLE',detail='PDF não pôde ser interpretado';let directory:string|undefined;
 try{
 if(!String(row.mime).toLowerCase().includes('pdf')&&!String(row.filename).toLowerCase().endsWith('.pdf')){status='UNSUPPORTED';detail='Formato não PDF; páginas desconhecidas';}
 else{directory=await mkdtemp(join(process.env.OPERATIONS_TEMP_DIR||tmpdir(),'operations-pages-'));const path=join(directory,'source.pdf');const original=await downloadAttachment(row.storage_key);if(!original)throw new Error('indisponível');const digest=createHash('sha256');
 await pipeline(Readable.fromWeb(original.stream as never),new Transform({transform(chunk,_encoding,callback){bytes+=chunk.length;if(bytes>limit){callback(new Error('limite de processamento'));return;}digest.update(chunk);callback(null,chunk);}}),createWriteStream(path,{flags:'wx'}));hash=digest.digest('hex');if(row.source_hash&&row.source_hash!==hash)throw new Error('hash divergente');
 const document=await PDFDocument.load(await readFile(path),{updateMetadata:false});pages=document.getPageCount();if(pages<1)throw new Error('PDF sem páginas');status='KNOWN';detail='pdf-lib: contagem de páginas do PDF original integral, sem alteração de bytes';}
 }catch{pages=null;status='UNREADABLE';detail='Original ausente, protegido, inválido, hash divergente ou acima do limite configurado; não contado como zero';}
 finally{if(directory)await rm(directory,{recursive:true,force:true});}
 await client.query(`INSERT INTO operation_page_metric(source_type,source_id,storage_key,source_hash,content_hash,pages,bytes,status,detail) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(source_type,source_id,storage_key,source_hash) DO UPDATE SET content_hash=excluded.content_hash,pages=excluded.pages,bytes=excluded.bytes,status=excluded.status,detail=excluded.detail,measured_at=now()`,[row.kind,row.id,row.storage_key,row.source_hash,hash,pages,bytes,status,detail]);measured++;
 }}await client.query('CLOSE page_sources');console.log(JSON.stringify({measured,completedAt:new Date().toISOString()}));
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{await client.end();}
}
