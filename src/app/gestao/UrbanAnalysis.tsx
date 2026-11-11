"use client";
import { useState } from "react";
import { api } from "@/components/session";
import type { Options } from "./client";
type Result={law:{title:string;revision:number};checks:{key:string;label:string;actual:number;limit:number|null;conforms:boolean|null}[];notice:string};
export function UrbanAnalysis({id,options}:{id:string;options:Options}) {
 const [law,setLaw]=useState(""),[result,setResult]=useState<Result>(),[error,setError]=useState("");
 return <section className="card"><h2>Conferência dos parâmetros urbanísticos</h2><label>Legislação de referência<select aria-label="Legislação de referência" value={law} onChange={e=>{setLaw(e.target.value);setResult(undefined);}}><option value="">Selecione</option>{options.records.filter(r=>r.family==="legislacao").map(r=><option key={r.id} value={r.id}>{r.code} — {r.title}</option>)}</select></label><button className="btn" disabled={!law} onClick={async()=>{try{setError("");setResult(await api(`/api/modules/records/${id}/urban-analysis?lawId=${law}`));}catch(e){setError((e as Error).message);}}}>Comparar com legislação</button>{error&&<p role="alert">{error}</p>}{result&&<><p>{result.law.title} · revisão {result.law.revision}</p>{result.checks.map(c=><p key={c.key}>{c.label}: {c.actual.toLocaleString("pt-BR",{maximumFractionDigits:4})} · limite {c.limit===null?"não informado":c.limit.toLocaleString("pt-BR")} · {c.conforms===null?"sem comparação":c.conforms?"dentro do limite":"fora do limite"}</p>)}<small>{result.notice}</small></>}</section>;
}
