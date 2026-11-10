"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {api,useSession} from "@/components/session";
import {DataTable} from "@/components/DataTable";
import type {ContactProfile,ContactSegment} from "@/lib/modules/contacts";
import {download} from "../client";
export type ContactRow={id:string;title:string;code:string;status:string;revision:number;values:Record<string,string>};
export default function Contacts(){
 const {user,permissions}=useSession();const [rows,setRows]=useState<ContactRow[]>([]);const [profiles,setProfiles]=useState<ContactProfile[]>([]);const [segments,setSegments]=useState<ContactSegment[]>([]);
 const [profile,setProfile]=useState("");const [segment,setSegment]=useState("");const [type,setType]=useState("");const [error,setError]=useState("");const [loading,setLoading]=useState(false);
 useEffect(()=>{if(!user)return;let live=true;setLoading(true);Promise.all([api(`/api/modules/contatos?${new URLSearchParams({profile,segment,type})}`),api("/api/modules/contatos/perfis"),api("/api/modules/contatos/segmentos")]).then(([r,p,s])=>{if(live){setRows(r);setProfiles(p);setSegments(s);setError("");}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[user,profile,segment,type]);
 if(user===null)return <p>Entre na sua conta para consultar contatos.</p>;
 return <DataTable id="contacts-dedicated" title="Contatos e organizações" rows={rows} rowKey={r=>r.id} loading={loading} error={error} actions={<><Link className="btn" href="/gestao">Módulos</Link>{permissions.includes("doc:create")&&<Link className="btn btn-primary" href="/gestao/contatos/novo">Novo contato</Link>}<Link className="btn" href="/gestao/contatos/segmentos">Listas</Link><Link className="btn" href="/gestao/contatos/perfis">Perfis de contato</Link>{permissions.includes("doc:edit")&&<Link className="btn" href="/gestao/contatos/unificar">Unificar</Link>}<Link className="btn" href="/gestao/contatos/importar">Importar CSV</Link><button className="btn" onClick={()=>download("/api/modules/contatos/export","contatos.csv").catch(e=>setError(e.message))}>Exportar CSV</button></>} filters={<><label>Perfil<select value={profile} onChange={e=>setProfile(e.target.value)}><option value="">Todos</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Lista<select value={segment} onChange={e=>setSegment(e.target.value)}><option value="">Todas</option>{segments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Tipo<select value={type} onChange={e=>setType(e.target.value)}><option value="">Todos</option>{["Pessoa física","Pessoa jurídica","Setor de organização"].map(t=><option key={t}>{t}</option>)}</select></label></>} columns={[
 {key:"code",label:"Código",value:r=>r.code,render:r=><Link href={`/gestao/contatos/cadastro/${r.id}`}>{r.code}</Link>},
 {key:"name",label:"Nome",value:r=>r.title},{key:"type",label:"Tipo",value:r=>r.values.tipo??""},{key:"email",label:"E-mail",value:r=>r.values.email??""},{key:"phone",label:"Telefone",value:r=>r.values.phone??""},{key:"status",label:"Situação",value:r=>r.status},
 ]}/>;
}
