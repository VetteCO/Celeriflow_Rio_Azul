"use client";
import { useEffect,useState } from "react";
import { api,useSession } from "@/components/session";
import { DataTable } from "@/components/DataTable";
type Ticket={id:string;code:string;subject:string;severity:string;status:string;assigneeId:string|null;dueAt:string;resolvedAt:string|null;firstResponseAt:string|null;rating:number|null;history:{at:string;actor:string;message:string;status:string;assignee:string|null}[]};
const labels:Record<string,string>={OPEN:"Aberto",IN_PROGRESS:"Em atendimento",ESCALATED:"Escalonado",RESOLVED:"Resolvido",CRITICAL:"Crítica — 2h",HIGH:"Alta — 8h",NORMAL:"Normal — 24h"};
export default function Support(){
 const {user}=useSession();const [tickets,setTickets]=useState<Ticket[]>([]);const [manager,setManager]=useState(false);const [selected,setSelected]=useState<string|null>(null);const [creating,setCreating]=useState(false);const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
 const [subject,setSubject]=useState("");const [message,setMessage]=useState("");const [severity,setSeverity]=useState("NORMAL");const [status,setStatus]=useState("");const [assignee,setAssignee]=useState("");const [rating,setRating]=useState("");const [assigneeChanged,setAssigneeChanged]=useState(false);const [sync,setSync]=useState("");
 async function load(){const d=await api("/api/operations/tickets");setTickets(d.tickets);setManager(d.manager);}
 useEffect(()=>{setAssigneeChanged(false);setSync("");},[selected]);
 useEffect(()=>{if(!user)return;const controller=new AbortController();api("/api/operations/tickets",{signal:controller.signal}).then(d=>{if(!controller.signal.aborted){setTickets(d.tickets);setManager(d.manager);}}).catch(e=>{if(!controller.signal.aborted)setErr(e.message);});return()=>controller.abort();},[user]);
 useEffect(()=>{
  if(!user||!selected||creating||busy)return;
  let active=true;let timer:ReturnType<typeof setTimeout>;let controller:AbortController|null=null;
  async function poll(){
   if(!active)return;
   if(document.visibilityState!=="visible"){timer=setTimeout(poll,12000);return;}
   controller=new AbortController();
   try{const d=await api(`/api/operations/tickets/${selected}`,{signal:controller.signal});if(active){setTickets(previous=>previous.map(t=>t.id===d.ticket.id?d.ticket:t));if(!assigneeChanged)setAssignee(d.ticket.assigneeId??"");setSync(`Atualizado às ${new Date().toLocaleTimeString("pt-BR")}. Atualização automática a cada 12 segundos.`);}}
   catch(e){if(active&&!controller.signal.aborted)setSync(`Atualização automática indisponível: ${(e as Error).message}. Nova tentativa em 12 segundos.`);}
   finally{if(active)timer=setTimeout(poll,12000);}
  }
  void poll();return()=>{active=false;clearTimeout(timer);controller?.abort();};
 },[user,selected,creating,busy,assigneeChanged]);
 async function submit(){setBusy(true);setErr("");try{if(creating){await api("/api/operations/tickets",{method:"POST",body:JSON.stringify({subject,message,severity})});setCreating(false);setSubject("");}else await api(`/api/operations/tickets/${selected}`,{method:"PATCH",body:JSON.stringify({message,...(manager?{...(status?{status}:{}),...(assigneeChanged?{assigneeId:assignee||null}:{})}:{}),...(rating?{rating:Number(rating)}:{})})});setMessage("");setRating("");setStatus("");setAssigneeChanged(false);await load();}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 if(!user)return <p>Entre com sua conta para acessar o suporte.</p>;
 const ticket=tickets.find(t=>t.id===selected);
 if(creating||ticket)return <div className="card"><button onClick={()=>{setSelected(null);setCreating(false);setErr("");}}>Voltar aos chamados</button><h1>{creating?"Abrir chamado":`${ticket!.code} · ${ticket!.subject}`}</h1>{err&&<p role="alert">{err}</p>}{ticket&&<><p>Situação: {labels[ticket.status]} · Prazo de solução: {new Date(ticket.dueAt).toLocaleString("pt-BR")} · Primeiro retorno: {ticket.firstResponseAt?new Date(ticket.firstResponseAt).toLocaleString("pt-BR"):"Não registrado"}</p><p>O prazo de solução é contado em horas corridas. Escalonar ou reabrir preserva o prazo original.</p><ol>{ticket.history.map((h,i)=><li key={i}><time>{new Date(h.at).toLocaleString("pt-BR")}</time> · {h.actor} · {labels[h.status]}<p style={{whiteSpace:"pre-wrap"}}>{h.message}</p></li>)}</ol></>}
 {ticket&&<p role="status" aria-live="polite">{sync}</p>}<form onSubmit={e=>{e.preventDefault();submit();}}>{creating&&<><label>Assunto <input required minLength={3} maxLength={200} value={subject} onChange={e=>setSubject(e.target.value)}/></label><label>Criticidade <select value={severity} onChange={e=>setSeverity(e.target.value)}>{["CRITICAL","HIGH","NORMAL"].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label></>}
 <label>{creating?"Descrição":"Mensagem no histórico"}<textarea required minLength={creating?10:1} maxLength={10000} value={message} onChange={e=>setMessage(e.target.value)}/></label>
 {!creating&&manager&&<><label>Situação <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Manter</option>{["OPEN","IN_PROGRESS","ESCALATED","RESOLVED"].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label><label>Identificador do responsável <input value={assignee} onChange={e=>{setAssignee(e.target.value);setAssigneeChanged(true);}} placeholder="UUID do servidor"/></label></>}
 {ticket?.status==="RESOLVED"&&<label>Avaliação do solicitante <select value={rating} onChange={e=>setRating(e.target.value)}><option value="">Sem avaliação</option>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label>}<button disabled={busy}>{busy?"Salvando…":"Salvar"}</button></form></div>;
 return <DataTable id="operations-tickets" title="Central de suporte" rows={tickets} rowKey={r=>r.id} error={err} actions={<button onClick={()=>{setCreating(true);setMessage("");}}>Abrir chamado</button>} columns={[{key:"code",label:"Código",value:r=>r.code},{key:"subject",label:"Assunto",value:r=>r.subject},{key:"status",label:"Situação",value:r=>labels[r.status]},{key:"severity",label:"Criticidade",value:r=>labels[r.severity]},{key:"sla",label:"SLA",value:r=>(r.resolvedAt?Date.parse(r.resolvedAt):Date.now())>Date.parse(r.dueAt)?"Prazo excedido":"Dentro do prazo"},{key:"action",label:"Ações",value:()=>"Acompanhar",render:r=><button onClick={()=>{setSelected(r.id);setAssignee(r.assigneeId??"");setStatus("");setMessage("");}}>Acompanhar</button>}]}/>;
}
