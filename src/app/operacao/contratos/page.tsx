"use client";
import {useEffect,useState} from "react";
import {api,useSession} from "@/components/session";
import {DataTable} from "@/components/DataTable";
import {saveFile} from "../client";
type Row={id:string;code:string;period:string;createdAt:string};
export default function ContractReports(){const {user}=useSession();const [rows,setRows]=useState<Row[]>([]);const [period,setPeriod]=useState(new Date().toISOString().slice(0,7));const [busy,setBusy]=useState(false);const [err,setErr]=useState("");const [creating,setCreating]=useState(false);const [filter,setFilter]=useState("");
 async function load(){const data=await api("/api/operations/contract-reports");setRows(data.reports);}
 useEffect(()=>{if(user)load().catch(e=>setErr(e.message));},[user]);
 if(!user)return <p>Entre com sua conta para consultar os relatórios contratuais.</p>;
 if(creating)return <section className="card"><button disabled={busy} onClick={()=>setCreating(false)}>Voltar aos relatórios</button><h1>Registrar relatório mensal</h1><p>Indicadores preservados na data de geração. Valores de faturamento dependem da regra contratual e da medição homologada.</p>{err&&<p role="alert">{err}</p>}<form onSubmit={async e=>{e.preventDefault();setBusy(true);setErr("");try{await api("/api/operations/contract-reports",{method:"POST",body:JSON.stringify({period,requestKey:`monthly:${period}`})});await load();setCreating(false);}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}}><label>Competência <input type="month" value={period} required onChange={e=>setPeriod(e.target.value)}/></label><button disabled={busy}>Registrar</button></form></section>;
 return <DataTable id="operations-contract-reports" title="Acompanhamento contratual" rows={rows.filter(r=>!filter||r.period===filter)} rowKey={r=>r.id} error={err} loading={busy}
 filters={<label>Competência <input type="month" value={filter} onChange={e=>setFilter(e.target.value)}/></label>}
 actions={<button onClick={()=>{setErr("");setCreating(true);}}>Registrar relatório mensal</button>}
 columns={[{key:"code",label:"Código",value:r=>r.code},{key:"period",label:"Competência",value:r=>r.period},{key:"date",label:"Registrado em",value:r=>new Date(r.createdAt).toLocaleString("pt-BR")},{key:"actions",label:"Exportar",value:()=>"CSV / PDF / XLSX",render:r=><>{["csv","pdf","xlsx"].map(f=><button key={f} disabled={busy} onClick={()=>saveFile(`/api/operations/contract-reports?id=${r.id}&format=${f}`,`contratual-${r.code}.${f}`).catch(e=>setErr(e.message))}>{f.toUpperCase()}</button>)}</>}]}/>;
}
