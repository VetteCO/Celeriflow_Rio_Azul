"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {api,useSession} from "@/components/session";
import type {ContactRow} from "../page";
export default function Merge(){
 const {user,permissions}=useSession();const [rows,setRows]=useState<ContactRow[]>([]);const [source,setSource]=useState("");const [target,setTarget]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 useEffect(()=>{if(user)api("/api/modules/contatos").then(setRows).catch(e=>setMessage(e.message));},[user]);
 const a=rows.find(r=>r.id===source),b=rows.find(r=>r.id===target);
 async function submit(){if(!a||!b)return;setBusy(true);try{
  const r=await api("/api/modules/contatos/unificar",{method:"POST",body:JSON.stringify({sourceId:a.id,targetId:b.id,sourceRevision:a.revision,targetRevision:b.revision})});
  setMessage(`Unificação concluída. Registros: ${r.counts.records}; listas: ${r.counts.segments}; vínculos legados: ${r.counts.legacyLinks}; requerimentos: ${r.counts.externalRequests}; identidades: ${r.counts.citizenIdentities}.`);
  setRows(await api("/api/modules/contatos"));setSource("");
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="card"><Link href="/gestao/contatos">← Contatos</Link><h1>Unificar contatos repetidos</h1><p>Os vínculos atuais serão transferidos para o cadastro principal. O cadastro de origem e seus históricos serão preservados; os dados cadastrais do principal prevalecem.</p>{message&&<p role="status">{message}</p>}<form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy||!permissions.includes("doc:edit")}>
 <label>Origem (duplicado ou união legada a reparar)<select required value={source} onChange={e=>{setSource(e.target.value);const row=rows.find(r=>r.id===e.target.value);if(row?.status==="UNIFICADO")setTarget(row.values.cadastroPrincipal??"");}}><option value="">Selecione</option>{rows.map(r=><option key={r.id} value={r.id}>{r.code} — {r.title}{r.status==="UNIFICADO"?" (reparar união legada)":""}</option>)}</select></label>
 <label>Principal (destino)<select required disabled={a?.status==="UNIFICADO"} value={target} onChange={e=>setTarget(e.target.value)}><option value="">Selecione</option>{rows.filter(r=>r.status!=="UNIFICADO").map(r=><option key={r.id} value={r.id}>{r.code} — {r.title}</option>)}</select></label>
 {a?.status==="UNIFICADO"&&<p>O reparo só é permitido para a união antiga que ainda não transferiu vínculos, mantendo o principal originalmente indicado.</p>}{a&&b&&<p>{a.title} → {b.title}</p>}<button className="btn btn-primary" disabled={!a||!b||source===target}>Unificar e reescrever vínculos</button></fieldset></form></section>;
}
