"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {externalRequest,externalError,useExternalAccount} from "../ExternalAccount";
import {ContactProfileFields} from "../ContactProfileFields";
import type {ContactProfile} from "@/lib/modules/contact-profile";
type Registration={name:string;profileId:string;revision:number;identityLocked:boolean;values:Record<string,string>;address:Record<string,string>};
export default function Registration(){
 const {user}=useExternalAccount();const [profiles,setProfiles]=useState<ContactProfile[]>([]);const [data,setData]=useState<Registration>();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 useEffect(()=>{if(!user?.emailVerified)return;let live=true;Promise.all([fetch("/api/modules/contatos/perfis/publicos",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Perfis indisponíveis.");return r.json();}),externalRequest("/api/cidadao/conta/cadastro").then(r=>r.json())]).then(([p,d])=>{if(live){setProfiles(p);setData({...d,name:d.name||user.displayName||"",values:{...d.values,email:user.email}});}}).catch(e=>{if(live)setMessage(externalError(e));});return()=>{live=false;};},[user]);
 const profile=profiles.find(p=>p.id===data?.profileId);
 async function save(){if(!data||!profile)return;setBusy(true);setMessage("");try{
  const values=Object.fromEntries(Object.entries(data.values).filter(([k])=>k==="tipo"||profile.definition.base.find(f=>f.key===k)?.enabled!==false));
  await externalRequest("/api/cidadao/conta/cadastro",{method:"POST",body:JSON.stringify({...data,values,address:profile.definition.base.find(f=>f.key==="endereco")?.enabled===false?{}:data.address,profileRevision:profile.revision})});
  const fresh=await externalRequest("/api/cidadao/conta/cadastro");setData(await fresh.json());setMessage("Cadastro salvo e vinculado à sua conta.");
 }catch(e){setMessage(externalError(e));}finally{setBusy(false);}}
 if(!user?.emailVerified)return <section className="card"><h1>Cadastro do contato</h1><p>Entre e confirme seu e-mail para preencher o cadastro.</p><Link href="/cidadao/conta">Minha conta</Link></section>;
 return <section className="card" style={{maxWidth:800}}><h1>Meu cadastro por perfil</h1><p>E-mail da conta: {user.email}. A conferência fiscal compara o CPF/CNPJ com o cadastro existente; não representa autenticação Gov.br ou por certificado.</p>{message&&<p role="status">{message}</p>}{data&&<form className="form" onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy}><label>Nome<input required readOnly={data.identityLocked} minLength={3} value={data.name} onChange={e=>setData({...data,name:e.target.value})}/></label><label>Perfil de contato<select required value={data.profileId} onChange={e=>setData({...data,profileId:e.target.value,values:Object.fromEntries(Object.entries(data.values).filter(([k])=>!k.startsWith("extra_")))})}><option value="">Selecione</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{profile&&<ContactProfileFields profile={profile} values={data.values} identityLocked={data.identityLocked} onChange={values=>setData({...data,values})}/>}<button className="btn btn-primary" disabled={!profile}>Salvar cadastro</button></fieldset></form>}<Link className="btn" href="/cidadao/conta">Minha conta</Link><Link className="btn" href="/cidadao">Abrir requerimento</Link></section>;
}
