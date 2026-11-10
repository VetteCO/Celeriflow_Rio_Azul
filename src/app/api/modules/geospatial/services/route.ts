import { context, listRecords, getRecord, failure, ModuleError } from "@/lib/modules/server";
export const dynamic="force-dynamic";
export async function GET(req:Request) {
 try {
  const url=new URL(req.url);
  if(url.searchParams.get("mode")==="inspections") {
   const ctx=await context(req);const records=await Promise.all((await listRecords("fiscalizacao",ctx)).map(r=>getRecord(r.id,ctx)));
   return Response.json({features:records.filter(r=>r.data.values?.latitude?.trim()&&r.data.values?.longitude?.trim()&&Number.isFinite(Number(r.data.values.latitude))&&Number.isFinite(Number(r.data.values.longitude))).map(r=>({type:"Feature",geometry:{type:"Point",coordinates:[Number(r.data.values!.longitude),Number(r.data.values!.latitude)]},properties:{protocolo:r.code,situacao:r.status,id:r.id}}))},{headers:{"cache-control":"private, no-store"}});
  }
  const query=url.searchParams.get("q");
  if(query) {
   if(query.length<3||query.length>200)throw new ModuleError("Informe endereço entre 3 e 200 caracteres.");
   const endpoint=process.env.MODULE_GEOCODER_URL;if(!endpoint)throw new ModuleError("Geocodificador não configurado.",409);
   const target=new URL(endpoint);if(target.protocol!=="https:")throw new ModuleError("O geocodificador deve usar HTTPS.",409);
   target.searchParams.set("q",query);target.searchParams.set("format","jsonv2");target.searchParams.set("limit","5");
   const response=await fetch(target,{headers:{"User-Agent":process.env.MODULE_GEOCODER_AGENT??"RioAzulMunicipal/1.0"},redirect:"error",signal:AbortSignal.timeout(8000),cache:"no-store"});
   if(!response.ok)throw new ModuleError("Geocodificador indisponível.",502);
   const body=await response.json();if(!Array.isArray(body))throw new ModuleError("Resposta incompatível do geocodificador.",502);
   return Response.json({results:body.slice(0,5).filter(v=>Number.isFinite(Number(v.lat))&&Number.isFinite(Number(v.lon))).map(v=>({label:String(v.display_name).slice(0,500),latitude:Number(v.lat),longitude:Number(v.lon)}))});
  }
  const template=process.env.MODULE_TILE_URL;const attribution=process.env.MODULE_TILE_ATTRIBUTION;const policy=process.env.MODULE_TILE_POLICY_URL;
  if(!template||!attribution||!policy)return Response.json({tiles:null,geocoder:!!process.env.MODULE_GEOCODER_URL});
  const parsed=new URL(template.replace("{z}","0").replace("{x}","0").replace("{y}","0"));
  const allowed=(process.env.MODULE_TILE_ALLOWED_ORIGINS??"").split(",").map(s=>s.trim());
  if(parsed.protocol!=="https:"||!allowed.includes(parsed.origin)||!/^https:\/\//.test(policy))throw new ModuleError("Origem ou política cartográfica não configurada.",409);
  return Response.json({tiles:{template,attribution,policy},geocoder:!!process.env.MODULE_GEOCODER_URL});
 }catch(e){return failure(e);}
}
