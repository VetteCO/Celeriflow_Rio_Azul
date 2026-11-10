"use client";
import { useEffect,useState } from "react";
import { api,useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
type Row={id:string;createdAt:string;actorId:string|null;action:string;entityType:string;entityId:string|null;metadata:unknown};
export default function Audit(){
 const {user}=useSession();const [rows,setRows]=useState<Row[]>([]);const [page,setPage]=useState(1);const [total,setTotal]=useState(0);const [error,setError]=useState("");const [loading,setLoading]=useState(false);
 const [filter,setFilter]=useState({actor:"",entity:"",from:"",to:""});const [query,setQuery]=useState("");const [search,setSearch]=useState("");const [sort,setSort]=useState({key:"time",desc:true});
 useEffect(()=>{
  if(!user)return;const controller=new AbortController();let active=true;setLoading(true);setError("");
  const timer=setTimeout(()=>{const params=new URLSearchParams(query);params.set("page",String(page));params.set("q",search);params.set("sort",sort.key);params.set("desc",String(sort.desc));
   api(`/api/operations/audit?${params}`,{signal:controller.signal}).then(d=>{if(active){setRows(d.rows);setTotal(d.total);if(d.page!==page)setPage(d.page);}}).catch(e=>{if(active&&!controller.signal.aborted)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  },250);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[user,page,query,search,sort]);
 if(!user)return <p>Entre com sua conta para consultar a auditoria.</p>;
 return <DataTable id="operations-audit" title="Trilha de auditoria" rows={rows} rowKey={r=>r.id} error={error} loading={loading}
 pagination={{page,total,onPageChange:setPage}} onSearch={q=>{setPage(1);setSearch(q);}} onSort={s=>{setPage(1);setSort(s);}}
 filters={<form onSubmit={e=>{e.preventDefault();const params=new URLSearchParams();if(filter.actor)params.set("actor",filter.actor);if(filter.entity)params.set("entity",filter.entity);if(filter.from)params.set("from",new Date(filter.from).toISOString());if(filter.to)params.set("to",new Date(filter.to).toISOString());setPage(1);setQuery(params.toString());}} style={{display:"flex",gap:8,alignItems:"center"}}>
 <label>Ator <input value={filter.actor} onChange={e=>setFilter({...filter,actor:e.target.value})}/></label><label>Entidade <input value={filter.entity} onChange={e=>setFilter({...filter,entity:e.target.value})}/></label>
 <label>De <input type="datetime-local" value={filter.from} onChange={e=>setFilter({...filter,from:e.target.value})}/></label><label>Até (exclusive) <input type="datetime-local" value={filter.to} onChange={e=>setFilter({...filter,to:e.target.value})}/></label><button>Filtrar</button></form>}
 columns={[{key:"time",label:"Data",value:r=>new Date(r.createdAt).toLocaleString("pt-BR")},{key:"actor",label:"Ator",value:r=>r.actorId??"Sistema"},{key:"action",label:"Ação",value:r=>r.action},{key:"entity",label:"Entidade",value:r=>r.entityType},{key:"record",label:"Registro",value:r=>r.entityId??"—"},{key:"metadata",label:"Contexto",value:r=>JSON.stringify(r.metadata??{})}]}/>;
}
