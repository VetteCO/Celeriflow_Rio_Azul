"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {api,useSession} from "@/components/session";
import {DataTable} from "@/components/DataTable";
import {parseCsv} from "@/lib/modules/formats";
import type {ContactProfile} from "@/lib/modules/contacts";
type Result={row:number;id:string|null;code:string|null;error:string|null};
export default function ImportContacts(){
 const {user}=useSession();const [profiles,setProfiles]=useState<ContactProfile[]>([]);const [profileId,setProfileId]=useState("");
 const [rows,setRows]=useState<{title:string;values:Record<string,string>;idempotencyKey:string}[]>([]);const [results,setResults]=useState<Result[]>([]);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 useEffect(()=>{if(user)api("/api/modules/contatos/perfis").then(setProfiles).catch(e=>setError(e.message));},[user]);
 const profile=profiles.find(p=>p.id===profileId);
 async function submit(){if(!profile)return;setBusy(true);try{const data=await api("/api/modules/contatos/import",{method:"POST",body:JSON.stringify({profileId,profileRevision:profile.revision,rows})});setResults(data.results);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(results.length)return <DataTable id="contact-import-results" title="Resultado da importação" rows={results} rowKey={r=>String(r.row)} error={error} actions={<><Link className="btn" href="/gestao/contatos">Contatos</Link><button className="btn" disabled={busy} onClick={submit}>Repetir lote com os mesmos identificadores</button><button className="btn" onClick={()=>setResults([])}>Revisar importação</button></>} columns={[{key:"row",label:"Linha",value:r=>r.row},{key:"code",label:"Código",value:r=>r.code??"—",render:r=>r.id?<Link href={`/gestao/contatos/cadastro/${r.id}`}>{r.code}</Link>:"—"},{key:"result",label:"Resultado",value:r=>r.error??"Importado como rascunho"}]}/>;
 return <section className="card"><h1>Importar contatos</h1><p>CSV UTF-8 separado por ponto e vírgula: nome;tipo;cpfCnpj;email;phone;cep;endereco;organizacao. Acrescente as chaves extra_ dos campos complementares do perfil. Até 100 contatos por envio.</p>{error&&<p role="alert">{error}</p>}<label>Perfil de contato<select value={profileId} onChange={e=>setProfileId(e.target.value)}><option value="">Selecione</option>{profiles.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Arquivo CSV<input type="file" accept=".csv" onChange={async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>1024*1024)throw new Error("Arquivo deve ter até 1 MB.");const [header,...data]=parseCsv(await file.text());if(!header?.includes("nome")||!header.includes("tipo"))throw new Error("Cabeçalhos nome e tipo são obrigatórios.");if(data.length>100)throw new Error("Divida o arquivo em até 100 contatos por envio.");setRows(data.map(row=>{const values=Object.fromEntries(header.map((key,i)=>[key,row[i]??""]));return{title:values.nome,values,idempotencyKey:crypto.randomUUID()};}));setError("");}catch(e){setError((e as Error).message);setRows([]);}}}/></label><p>{rows.length} contatos preparados.</p><button className="btn btn-primary" disabled={busy||!rows.length||!profile} onClick={submit}>{busy?"Importando…":"Importar contatos"}</button><Link className="btn" href="/gestao/contatos">Voltar</Link></section>;
}
