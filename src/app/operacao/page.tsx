"use client";
import { useEffect,useState } from "react";
import { api,useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
import { saveFile } from "./client";
type Row={id:string;category:string;indicator:string;value:number;unit:string;source:string};
export default function Reports(){
 const {user}=useSession();const today=new Date().toISOString().slice(0,10);
 const [filters,setFilters]=useState({from:today.slice(0,8)+"01",to:today,department:"",user:"",module:""});
 const [query,setQuery]=useState(new URLSearchParams(filters).toString());const [rows,setRows]=useState<Row[]>([]);const [options,setOptions]=useState<{departments:{id:string;name:string}[];users:{id:string;name:string}[]}>({departments:[],users:[]});
 const [error,setError]=useState("");const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);const [notes,setNotes]=useState<string[]>([]);const [methodology,setMethodology]=useState(false);
 useEffect(()=>{if(!user)return;let active=true;setLoading(true);setError("");api(`/api/operations/reports?${query}`).then(d=>{if(active){setRows(d.rows);setOptions(d);setNotes(d.limitations);}}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false;};},[user,query]);
 async function exportFile(format:string){setBusy(true);try{await saveFile(`/api/operations/reports?${query}&format=${format}`,`relatorio.${format}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!user)return <p>Entre com sua conta para acessar a gestão.</p>;
  if(methodology)return <section className="card"><button onClick={()=>setMethodology(false)}>Voltar aos relatórios</button><h1>Metodologia e volumetria</h1>{notes.map(n=><p key={n}>{n}</p>)}{rows.filter(r=>["volume","moves","reads"].includes(r.id)).map(r=><div key={r.id}>{r.indicator}: {r.value} <meter aria-label={r.indicator} min={0} max={Math.max(1,...rows.filter(x=>["volume","moves","reads"].includes(x.id)).map(x=>x.value))} value={r.value}/></div>)}</section>;
  const filterForm=<form onSubmit={e=>{e.preventDefault();setQuery(new URLSearchParams(filters).toString());}} style={{display:"flex",gap:8,alignItems:"center"}}>
 <label>De <input type="date" required value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label><label>Até <input type="date" required value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label>
 <label>Setor <select value={filters.department} onChange={e=>setFilters({...filters,department:e.target.value})}><option value="">Todos</option>{options.departments.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 <label>Servidor <select value={filters.user} onChange={e=>setFilters({...filters,user:e.target.value})}><option value="">Todos</option>{options.users.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <label>Módulo <input aria-label="Tipo documental ou entidade auditada" value={filters.module} onChange={e=>setFilters({...filters,module:e.target.value})} placeholder="MEMORANDUM"/></label><button>Aplicar</button></form>;
  return <DataTable id="operations-reports" title="Relatórios de gestão" rows={rows} rowKey={r=>r.id} loading={loading} error={error} filters={filterForm} actions={<><button onClick={()=>setMethodology(true)}>Metodologia e gráfico</button>{["csv","pdf","xlsx"].map(f=><button key={f} disabled={busy||loading} onClick={()=>exportFile(f)}>{f.toUpperCase()}</button>)}</>} columns={[
 {key:"category",label:"Categoria",value:r=>r.category},{key:"indicator",label:"Indicador",value:r=>r.indicator},{key:"value",label:"Valor",value:r=>r.value},{key:"unit",label:"Unidade",value:r=>r.unit},{key:"source",label:"Origem",value:r=>r.source},
  ]}/>;
}
