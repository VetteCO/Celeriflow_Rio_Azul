"use client";
import { useRef, useState } from "react";
import { api } from "@/components/session";
import type { Detail } from "./client";
export function Inspection({ detail, reload }: { detail: Detail; reload: () => Promise<void> }) {
  const [latitude,setLatitude]=useState(detail.record.data.values?.latitude ?? ""),[longitude,setLongitude]=useState(detail.record.data.values?.longitude ?? ""),[accuracy,setAccuracy]=useState<number>();
  const [findings,setFindings]=useState(""),[measures,setMeasures]=useState(""),[files,setFiles]=useState<string[]>([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const operation = useRef<{ body:string }>();
  const canWrite=detail.permissions.actions.includes("REGISTRAR_VISTORIA");
  function manualLatitude(value:string){setLatitude(value);setAccuracy(undefined);}
  function manualLongitude(value:string){setLongitude(value);setAccuracy(undefined);}
  async function send() {
    if(busy)return;setBusy(true);setMessage("");
    try {
      operation.current ??= {body:JSON.stringify({revision:detail.record.revision,inspection:{operationId:crypto.randomUUID(),capturedAt:new Date().toISOString(),latitude:Number(latitude),longitude:Number(longitude),accuracy,findings,measures,fileIds:files}})};
      await api(`/api/modules/records/${detail.record.id}/inspections`,{method:"POST",body:operation.current.body});operation.current=undefined;setFindings("");setMeasures("");setFiles([]);await reload();setMessage("Vistoria preservada com data de captura, localização e evidências.");
    }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  async function revise() {
    setBusy(true);
    try { await reload(); operation.current=undefined; setMessage("Histórico atualizado. Confira as vistorias recebidas antes de registrar outra operação."); }
    catch(e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="card">
    <h2>Vistorias de campo</h2>{message&&<p role="status">{message}</p>}
    {canWrite&&<fieldset disabled={busy||!!operation.current}>
      <legend>Registrar vistoria</legend>
      <p>Os anexos devem ser enviados antes do registro. Uma operação pendente conserva seu identificador e conteúdo para repetição segura.</p>
      <button className="btn" type="button" onClick={()=>{
        if(!navigator.geolocation){setMessage("Localização indisponível neste dispositivo.");return;}
        navigator.geolocation.getCurrentPosition(p=>{setLatitude(String(p.coords.latitude));setLongitude(String(p.coords.longitude));setAccuracy(p.coords.accuracy);},()=>setMessage("Não foi possível obter a localização. Confira a permissão do dispositivo ou informe as coordenadas."),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
      }}>Obter localização do dispositivo</button>
      <label>Latitude da vistoria<input type="number" min={-90} max={90} step="any" value={latitude} onChange={e=>manualLatitude(e.target.value)}/></label>
      <label>Longitude da vistoria<input type="number" min={-180} max={180} step="any" value={longitude} onChange={e=>manualLongitude(e.target.value)}/></label>
      {accuracy!==undefined&&<p>Precisão informada pelo dispositivo: {accuracy.toFixed(1)} metros.</p>}
      <label>Constatações<textarea value={findings} onChange={e=>setFindings(e.target.value)}/></label>
      <label>Providências da vistoria<textarea value={measures} onChange={e=>setMeasures(e.target.value)}/></label>
      <label>Evidências anexadas<select multiple aria-label="Evidências anexadas" value={files} onChange={e=>setFiles(Array.from(e.target.selectedOptions).map(o=>o.value))}>{detail.files.map(f=><option key={f.id} value={f.id}>{f.filename}</option>)}</select></label>
    </fieldset>}
    {canWrite&&<div className="form-row">
      <button className="btn btn-primary" disabled={busy||!operation.current&&(!latitude.trim()||!longitude.trim()||findings.trim().length<3)} onClick={()=>void send()}>{operation.current?"Repetir operação pendente":"Preservar vistoria"}</button>
      {operation.current&&<button className="btn" disabled={busy} onClick={()=>void revise()}>Revisar dados da operação</button>}
    </div>}
    <h3>Histórico de vistorias</h3>
    {detail.record.data.inspections?.map(i=><article key={i.operationId}><strong>{new Date(i.capturedAt).toLocaleString("pt-BR")}</strong><p>{i.findings}</p><p>{i.measures}</p><small>{i.latitude}, {i.longitude} · {i.fileIds.length} evidência(s) · recebido em {new Date(i.receivedAt).toLocaleString("pt-BR")}</small></article>)??<p>Nenhuma vistoria registrada.</p>}
  </section>;
}
