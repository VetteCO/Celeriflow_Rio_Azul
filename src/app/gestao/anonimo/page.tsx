"use client";
import {useEffect,useRef,useState} from "react";
import {DataTable} from "@/components/DataTable";
import {WorkflowField} from "@/components/WorkflowField";
import {conditionMatches, type Field} from "@/lib/modules/domain";
type RecordView={code:string;title:string;body:string;status:string;revision:number;canEvaluate:boolean;requiredFiles:string[];evaluation?:{score:number;comment:string};files:{id:string;filename:string;category:string;size:number}[];messages:{text:string;at:string;source:string}[]};
type Option={id:string;title:string;fields:Field[];requiredFiles:string[]};
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
export default function Anonymous(){
 const [key,setKey]=useState("");const [title,setTitle]=useState("");const [body,setBody]=useState("");const [purpose,setPurpose]=useState("Denúncia");const [text,setText]=useState("");const [score,setScore]=useState(5);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [record,setRecord]=useState<RecordView>();const [options,setOptions]=useState<Option[]>([]);const [flow,setFlow]=useState("");const [values,setValues]=useState<Record<string,string>>({});const [file,setFile]=useState<File>();const [category,setCategory]=useState("Anexo");const [tab,setTab]=useState("relato");
 const pending=useRef<{signature:string;id:string}>();const newKey=useRef("");
 useEffect(()=>{fetch("/api/modules/anonymous",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setOptions(d);}).catch(e=>setMessage(e.message));},[]);
 async function call(payload:Record<string,unknown>){const r=await fetch("/api/modules/anonymous",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}
 async function refresh(k=key){setRecord(await call({action:"READ",key:k}));}
 function operation(signature:string){if(pending.current?.signature!==signature)pending.current={signature,id:crypto.randomUUID()};return pending.current.id;}
 async function request(action:string){setBusy(true);setMessage("");try{
  if(action==="CREATE"){if(!newKey.current)newKey.current=secret();const k=newKey.current;setKey(k);const d=await call({action,key:k,title,body,purpose,workflowId:flow,values});setMessage(`Rascunho ${d.code} salvo. Guarde a chave abaixo e conclua a protocolização após anexar os documentos.`);await refresh(k);}
  else if(action==="READ"){setRecord(undefined);await refresh();}
  else {const payload={action,key,text,score,revision:record?.revision};await call({...payload,operationId:operation(JSON.stringify({action,key,text,score}))});pending.current=undefined;await refresh();setText("");setMessage("Operação registrada.");}
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function upload(){if(!file||!record)return;setBusy(true);setMessage("");try{const form=new FormData();form.set("file",file);form.set("category",category);form.set("revision",String(record.revision));form.set("operationId",operation(`${key}:${file.name}:${file.size}:${file.lastModified}:${category}`));const r=await fetch("/api/modules/anonymous/files",{method:"POST",headers:{"x-anonymous-key":key},body:form});const d=await r.json();if(!r.ok)throw new Error(d.error);pending.current=undefined;setFile(undefined);await refresh();setMessage("Anexo recebido.");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function download(id:string,name:string){setBusy(true);try{const r=await fetch(`/api/modules/anonymous/files/${id}`,{method:"POST",headers:{"x-anonymous-key":key}});if(!r.ok)throw new Error((await r.json()).error);const url=URL.createObjectURL(await r.blob());const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 const selected=options.find(o=>o.id===flow);
 return <><section className="card">
  <h1>Ouvidoria anônima</h1><p>Guarde a chave de acompanhamento em local privado. Ela é a única forma de acesso e não pode ser recuperada. Evite identificar-se no relato e nos arquivos.</p>
  {message&&<p role="status">{message}</p>}
  <nav><button className="btn" onClick={()=>setTab("relato")}>Manifestação</button><button className="btn" onClick={()=>setTab("anexos")} disabled={!record}>Anexos ({record?.files.length??0})</button></nav>
  {tab==="relato"&&<>
   {!record&&<form onSubmit={e=>{e.preventDefault();void request("CREATE");}}><fieldset disabled={busy}>
    <legend>Nova manifestação</legend>
    <label>Assunto configurado<select required value={flow} onChange={e=>{setFlow(e.target.value);setValues({});}}><option value="">Selecione</option>{options.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
    <label>Finalidade<select value={purpose} onChange={e=>setPurpose(e.target.value)}>{["Denúncia","Elogio","Reclamação","Solicitação","Sugestão"].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Título<input required minLength={3} maxLength={250} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Relato<textarea required minLength={10} maxLength={20000} rows={6} value={body} onChange={e=>setBody(e.target.value)}/></label>
    {selected?.fields.filter(field=>!["modalidade","finalidade"].includes(field.key)&&!field.calculation&&conditionMatches(field,{...values,modalidade:"Anônima",finalidade:purpose})).map(field=><WorkflowField key={field.key} field={field} value={values[field.key]??""} onChange={value=>setValues(current=>({...current,[field.key]:value}))}/>)}
    <button className="btn btn-primary" disabled={!flow}>Salvar manifestação</button>
   </fieldset></form>}
   <fieldset disabled={busy}><legend>Acompanhamento protegido</legend><label>Chave secreta<input autoComplete="off" spellCheck={false} value={key} onChange={e=>{setKey(e.target.value.trim());setRecord(undefined);pending.current=undefined;}}/></label><button className="btn" disabled={key.length!==64} onClick={()=>request("READ")}>Consultar</button><button className="btn" disabled={!key} onClick={()=>navigator.clipboard.writeText(key).then(()=>setMessage("Chave copiada.")).catch(()=>setMessage("Selecione e copie a chave manualmente."))}>Copiar chave</button></fieldset>
   {record&&<><h2>{record.code} — {record.title}</h2><p>{record.status}</p><p style={{whiteSpace:"pre-wrap"}}>{record.body}</p>{record.messages.map((m,i)=><p key={i}><strong>{m.source}</strong> ({new Date(m.at).toLocaleString("pt-BR")}): {m.text}</p>)}
    {record.status==="RASCUNHO"&&<><p>Anexos obrigatórios: {record.requiredFiles.join(", ")||"nenhum"}.</p><button className="btn btn-primary" disabled={busy} onClick={()=>request("SUBMIT")}>Protocolar manifestação</button></>}
    {record.status==="EM_ANDAMENTO"&&<><label>Complementação<textarea maxLength={20000} value={text} onChange={e=>setText(e.target.value)}/></label><button className="btn" disabled={busy||!text.trim()} onClick={()=>request("REPLY")}>Complementar relato</button></>}
    {record.canEvaluate&&<fieldset disabled={busy}><legend>Avaliação do atendimento</legend>{record.evaluation&&<p>Nota atual: {record.evaluation.score}/5. A nova avaliação substitui a anterior.</p>}<label>Estrelas<select value={score} onChange={e=>setScore(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}</select></label><label>Comentário<textarea value={text} onChange={e=>setText(e.target.value)}/></label><button className="btn" onClick={()=>request("EVALUATE")}>Registrar avaliação</button></fieldset>}
   </>}
  </>}
 </section>{tab==="anexos"&&record&&<><section className="card">{["RASCUNHO","EM_ANDAMENTO"].includes(record.status)&&<fieldset disabled={busy}><legend>Enviar anexo</legend><p>PDF, PNG, JPEG ou TXT; até 5 MB por arquivo, 20 arquivos e 50 MB no total.</p><label>Categoria<input list="anonymous-categories" value={category} onChange={e=>setCategory(e.target.value)}/><datalist id="anonymous-categories">{record.requiredFiles.map(c=><option key={c}>{c}</option>)}</datalist></label><input aria-label="Arquivo" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={e=>setFile(e.target.files?.[0])}/><button className="btn" disabled={!file||!category.trim()} onClick={upload}>Enviar arquivo</button></fieldset>}</section><DataTable id="anonymous-files" title={`Anexos — ${record.code}`} rows={record.files} rowKey={f=>f.id} columns={[{key:"name",label:"Arquivo",value:f=>f.filename},{key:"category",label:"Categoria",value:f=>f.category},{key:"size",label:"Tamanho",value:f=>`${(f.size/1024).toFixed(1)} KB`},{key:"download",label:"Ações",value:()=>"Baixar",render:f=><button className="btn" disabled={busy} onClick={()=>download(f.id,f.filename)}>Baixar</button>}]}/></>}</>;
}
