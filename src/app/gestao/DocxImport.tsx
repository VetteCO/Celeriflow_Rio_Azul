"use client";
import { useState } from "react";
import { getToken } from "@/components/session";
import type { ContentBlock } from "@/lib/modules/domain";
export function DocxImport({id,onImport}:{id:string;onImport:(blocks:ContentBlock[])=>void}) {
 const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 return <fieldset><legend>Importar modelo Word</legend><input aria-label="Modelo DOCX" disabled={busy} type="file" accept=".docx" onChange={async e=>{
  const file=e.target.files?.[0];if(!file)return;setBusy(true);try{
   const form=new FormData();form.append("file",file);const token=await getToken();const response=await fetch(`/api/modules/records/${id}/docx`,{method:"POST",headers:{authorization:`Bearer ${token}`},body:form});const data=await response.json();if(!response.ok)throw new Error(data.error);
   const doc=new DOMParser().parseFromString(data.html,"text/html");const blocks:ContentBlock[]=[];
   const image=(node:Element)=>blocks.push({type:"image",url:node.getAttribute("src")??"",caption:node.getAttribute("alt")??"Imagem do modelo"});
   for(const node of Array.from(doc.body.children)) {
    if(node.tagName==="TABLE") {blocks.push({type:"table",rows:Array.from(node.querySelectorAll("tr")).map(tr=>Array.from(tr.querySelectorAll("td,th")).map(c=>c.textContent??""))});for(const img of Array.from(node.querySelectorAll("img")))image(img);}
    else if(node.tagName==="IMG")image(node);
    else {if(node.textContent?.trim())blocks.push({type:"paragraph",text:node.textContent,bold:!!node.querySelector("strong"),italic:!!node.querySelector("em"),underline:!!node.querySelector("u"),align:"left",size:node.tagName.startsWith("H")?20:14});for(const img of Array.from(node.querySelectorAll("img")))image(img);}
   }
   onImport(blocks);setMessage(`Original preservado: ${data.filename}. Salve a nova versão dos blocos. ${data.warnings.join("; ")}`);
  }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
 }}/><p role="status">{busy?"Convertendo modelo…":message}</p></fieldset>;
}
