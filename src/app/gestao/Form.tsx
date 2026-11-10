"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MaskedInput } from "@/components/MaskedInput";
import { WorkflowField } from "@/components/WorkflowField";
import type { FamilyField } from "@/lib/modules/domain";
import { familyFields, families, processFamilies, renderTemplate, conditionMatches, type Family, type Field, type Workflow } from "@/lib/modules/domain";
import { DocxImport } from "./DocxImport";
import { WorkflowRules } from "./WorkflowRules";
import type { Options, RecordRow } from "./client";
import { BlockEditor } from "./Content";
import { ShapefileImport } from "./ShapefileImport";
import { api } from "@/components/session";

export function ModuleForm({ family, options, initial, onSave, onAutoSave, busy }: { family: Family; options: Options; initial?: RecordRow; onSave: (input: Record<string, unknown>) => Promise<void>; onAutoSave?: (input: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [title, setTitle] = useState(initial?.title ?? ""); const [body, setBody] = useState(initial?.body ?? "");
  const [blocks, setBlocks] = useState(initial?.data.blocks ?? []);
  const [values, setValues] = useState<Record<string, string>>(initial?.data.values ?? {});
  const [workflowId, setWorkflowId] = useState(initial?.data.workflowId ?? "");
  const [workflow, setWorkflow] = useState<Workflow>(initial?.data.workflow ?? { family: "processos", fields: [], steps: [{ name: "Análise", departments: [], hours: 24, decision: true }], requiredFiles: [] });
  const [linkedIds, setLinkedIds] = useState(initial?.data.linkedIds ?? []);
  const [coreDocumentIds, setCoreDocumentIds] = useState(initial?.data.coreDocumentIds ?? []);
  const [tags, setTags] = useState(initial?.data.tags?.join(", ") ?? "");
  const [classificationId, setClassificationId] = useState(initial?.data.classificationId ?? "");
  const [geometry, setGeometry] = useState(initial?.data.geometry ? JSON.stringify(initial.data.geometry, null, 2) : "");
  const [identity, setIdentity] = useState(initial?.data.identity ?? { name: "", email: "", cpfCnpj: "", phone: "" });
  const [agenda, setAgenda] = useState(initial?.data.agenda ?? []); const [attendees, setAttendees] = useState(initial?.data.attendees?.join("\n") ?? "");
  const [error, setError] = useState(""); const [fullscreen, setFullscreen] = useState(false);
  const [autoStatus, setAutoStatus] = useState("");
  const submitting = useRef(false);
  const [leased, setLeased] = useState(!initial);
  const [leaseToken,setLeaseToken]=useState("");
  useEffect(() => {
    if (!initial?.id) return;
    let token: string | undefined; let stopped = false;
    const renew = async () => { try { const result = await api(`/api/modules/records/${initial.id}/lease`, { method: "POST", body: JSON.stringify({ token }) }); token = result.token; if (!stopped) {setLeased(true);setLeaseToken(result.token);} else void api(`/api/modules/records/${initial.id}/lease`, { method:"POST", body:JSON.stringify({token,release:true}) }); } catch(e) { if(!stopped) { setLeased(false); setError((e as Error).message); } } };
    void renew(); const interval = setInterval(renew, 30000);
    return () => { stopped=true; clearInterval(interval); if(token) void api(`/api/modules/records/${initial.id}/lease`, {method:"POST",body:JSON.stringify({token,release:true})}).catch(()=>{}); };
  }, [initial?.id]);
  const saveRef = useRef(onAutoSave); saveRef.current = onAutoSave;
  const autoPayload = useMemo(() => ({ title, body, blocks, values, workflowId: workflowId || undefined, workflow: family === "fluxos" ? workflow : undefined, linkedIds, coreDocumentIds, tags: tags.split(",").map(v => v.trim()).filter(Boolean), classificationId: classificationId || undefined, identity: family === "ouvidoria" && values.modalidade !== "Anônima" ? identity : undefined, agenda, attendees: attendees.split("\n").map(s => s.trim()).filter(Boolean) }), [title, body, blocks, values, workflowId, workflow, family, linkedIds, coreDocumentIds, tags, classificationId, identity, agenda, attendees]);
  const previousPayload = useRef(JSON.stringify(autoPayload));
  const failedPayload = useRef("");
  useEffect(() => {
    const serialized = JSON.stringify(autoPayload);
    if (busy || !leased || !saveRef.current || family === "camadas" || serialized === previousPayload.current || serialized === failedPayload.current) return;
    const timer = setTimeout(async () => {
      setAutoStatus("Salvando rascunho…");
      try { await saveRef.current?.({...autoPayload,leaseToken}); previousPayload.current = serialized; failedPayload.current = ""; setAutoStatus("Rascunho salvo no servidor."); }
      catch (e) { failedPayload.current = serialized; setAutoStatus(`Salvamento automático interrompido: ${(e as Error).message}. Use Salvar para tentar novamente.`); }
    }, 2500);
    return () => clearTimeout(timer);
  }, [autoPayload, family, leased,leaseToken,busy]);
  const selectedWorkflow = initial?.data.workflow ?? options.configurations.find(c => c.id === workflowId)?.data.workflow;
  const setValue = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }));
  const field = (definition: FamilyField) => <WorkflowField key={definition.key} field={definition} value={values[definition.key] ?? ""} onChange={value => setValue(definition.key, value)} />;
  return <form onSubmit={async event => {
    event.preventDefault(); if (submitting.current || busy) return; if (!leased) { setError("Aguarde a reserva exclusiva de edição."); return; } setError(""); submitting.current = true;
    try { await onSave({ ...autoPayload, leaseToken, geometry: family === "camadas" ? JSON.parse(geometry) : undefined }); }
    catch (e) { setError((e as Error).message); }
    finally { submitting.current = false; }
  }} style={{ display: "grid", gap: 12 }}>
    {error && <p role="alert" className="alert alert-error">{error}</p>}
    {autoStatus && <p role="status">{autoStatus}</p>}
    <label>Título / assunto *<input required minLength={3} maxLength={250} value={title} onChange={e => setTitle(e.target.value)} /></label>
    {processFamilies.includes(family) && <label>Assunto e fluxo *<select required disabled={!!initial} value={workflowId} onChange={e => setWorkflowId(e.target.value)}><option value="">Selecione o fluxo</option>{options.configurations.filter(c => c.family === "fluxos" && c.data.workflow?.family === family).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>{(familyFields[family] ?? []).map(field)}{selectedWorkflow?.fields.filter(f => conditionMatches(f, values) && !f.calculation).map(field)}</div>
    {family === "ouvidoria" && values.modalidade !== "Anônima" && <fieldset><legend>Identificação do manifestante</legend><label>Nome<input value={identity.name} onChange={e => setIdentity({ ...identity, name: e.target.value })} required /></label><label>E-mail<input type="email" value={identity.email} onChange={e => setIdentity({ ...identity, email: e.target.value })} required /></label><label>CPF/CNPJ<MaskedInput kind="cpfCnpj" value={identity.cpfCnpj} onValueChange={value => setIdentity({ ...identity, cpfCnpj: value })} /></label><label>Telefone<MaskedInput kind="phone" value={identity.phone} onValueChange={value => setIdentity({ ...identity, phone: value })} /></label></fieldset>}
    <fieldset style={fullscreen ? { position: "fixed", inset: 12, zIndex: 50, background: "white", padding: 20, display: "flex", flexDirection: "column" } : {}}><legend>Conteúdo</legend><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>Modelo<select defaultValue="" onChange={e => { const model = options.configurations.find(m => m.id === e.target.value); if (model) setBody(renderTemplate(model.body, { ...values, assunto: title, data: new Date().toLocaleDateString("pt-BR") })); }}><option value="">Selecionar modelo</option>{options.configurations.filter(c => c.family === "modelos").map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label><button type="button" className="btn" onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? "Sair da tela cheia" : "Tela cheia"}</button></div><textarea aria-label="Conteúdo do documento" spellCheck lang="pt-BR" rows={12} value={body} onChange={e => setBody(e.target.value)} style={{ width: "100%", flex: fullscreen ? 1 : undefined }} /><small>Modelos aceitam variáveis como {"{{assunto}}"}, {"{{data}}"} e chaves dos campos do formulário.</small></fieldset>
    <BlockEditor value={blocks} onChange={setBlocks} />
    {family === "modelos" && initial && <DocxImport id={initial.id} onImport={setBlocks} />}
    <label>Aplicar blocos de um modelo<select defaultValue="" onChange={e=>{const model=options.configurations.find(m=>m.id===e.target.value);if(model)setBlocks((model.data.blocks??[]).map(b=>b.type==="paragraph"?{...b,text:renderTemplate(b.text,{...values,assunto:title,data:new Date().toLocaleDateString("pt-BR")})}:b.type==="table"?{...b,rows:b.rows.map(r=>r.map(c=>renderTemplate(c,values)))}:b));}}><option value="">Selecione</option>{options.configurations.filter(m=>m.family==="modelos").map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
    {family === "fluxos" && <label>Permitir manifestações anônimas sem conta (Ouvidoria)<select value={values.anonymousEnabled??"Não"} onChange={e=>setValue("anonymousEnabled",e.target.value)}><option>Não</option><option>Sim</option></select></label>}
    {family === "fluxos" && <WorkflowRules value={workflow} onChange={setWorkflow} departments={options.departments}/>}
    {family === "carta" && <label>Assunto da central externa<select value={values.assuntoId ?? ""} onChange={e => setValue("assuntoId", e.target.value)}><option value="">Sem vínculo direto</option>{options.configurations.filter(c => c.family === "fluxos" && c.data.values?.externalEnabled === "Sim").map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
    {family === "camadas" && <ShapefileImport onImported={(geo, filename, projection) => { setGeometry(JSON.stringify(geo, null, 2)); setValues(v => ({ ...v, sourceFile: filename, sourceProjection: projection })); }} />}
    <label>Protocolos e documentos do núcleo<select multiple value={coreDocumentIds} onChange={e => setCoreDocumentIds(Array.from(e.target.selectedOptions).map(o => o.value))}>{options.coreDocuments.map(d => <option key={d.id} value={d.id}>{d.number}/{d.year} — {d.subject}</option>)}</select></label>
    {family === "fluxos" && <><label>Receber solicitações na central externa<select value={values.externalEnabled ?? "Não"} onChange={e => setValue("externalEnabled", e.target.value)}><option>Não</option><option>Sim</option></select></label><WorkflowEditor value={workflow} onChange={setWorkflow} options={options} /></>}
    {family === "pauta" && <fieldset><legend>Reunião</legend><label>Participantes, um por linha<textarea value={attendees} onChange={e => setAttendees(e.target.value)} /></label>{agenda.map((item, index) => <div key={index} style={{ display: "flex", gap: 8 }}><input aria-label={`Item ${index + 1}`} placeholder="Item de pauta" value={item.title} onChange={e => setAgenda(agenda.map((a, i) => i === index ? { ...a, title: e.target.value } : a))} /><input aria-label={`Responsável pelo item ${index + 1}`} placeholder="Responsável" value={item.responsible} onChange={e => setAgenda(agenda.map((a, i) => i === index ? { ...a, responsible: e.target.value } : a))} /><button type="button" onClick={() => setAgenda(agenda.filter((_, i) => i !== index))}>Remover</button></div>)}<button type="button" className="btn" onClick={() => setAgenda([...agenda, { title: "", responsible: "", decision: "" }])}>Adicionar item</button></fieldset>}
    {family === "camadas" && <fieldset><legend>Base geográfica</legend><label>Importar GeoJSON<input type="file" accept=".json,.geojson" onChange={async e => { const f = e.target.files?.[0]; if (f) setGeometry(await f.text()); }} /></label><label>GeoJSON WGS84<textarea rows={12} required value={geometry} onChange={e => setGeometry(e.target.value)} /></label><label>Publicar no geoportal<select value={values.publicar ?? "Não"} onChange={e => setValue("publicar", e.target.value)}><option>Não</option><option>Sim</option></select></label></fieldset>}
    <fieldset><legend>Vínculos e classificação</legend><label>Documentos relacionados<select multiple value={linkedIds} onChange={e => setLinkedIds(Array.from(e.target.selectedOptions).map(o => o.value))}>{options.records.filter(r => r.id !== initial?.id).map(r => <option key={r.id} value={r.id}>{r.code} — {r.title}</option>)}</select></label><label>Classificação<select value={classificationId} onChange={e => setClassificationId(e.target.value)}><option value="">Sem classificação</option>{options.configurations.filter(c => c.family === "classificacao").map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Etiquetas (separadas por vírgula)<input value={tags} onChange={e => setTags(e.target.value)} /></label></fieldset>
    <button type="submit" disabled={busy || !leased} className="btn btn-primary">{busy ? "Salvando…" : initial ? "Salvar nova versão" : "Salvar rascunho"}</button>
  </form>;
}

function WorkflowEditor({ value, onChange, options }: { value: Workflow; onChange: (workflow: Workflow) => void; options: Options }) {
  const updateField = (index: number, patch: Partial<Field>) => onChange({ ...value, fields: value.fields.map((field, i) => i === index ? { ...field, ...patch } : field) });
  return <fieldset><legend>Configuração do fluxo</legend><label>Módulo<select value={value.family} onChange={e => onChange({ ...value, family: e.target.value as Family })}>{processFamilies.map(f => <option key={f} value={f}>{families[f]}</option>)}</select></label>
    {value.family === "pessoal" && <label>Setor de Recursos Humanos<select value={value.rhDepartmentId ?? ""} onChange={e => onChange({ ...value, rhDepartmentId: e.target.value })}><option value="">Selecione</option>{options.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
    {value.family === "ouvidoria" && <label>Ouvidoria — setor que pode consultar a identidade sigilosa<select required value={value.identityDepartmentId ?? ""} onChange={e => onChange({ ...value, identityDepartmentId: e.target.value || undefined })}><option value="">Selecione</option>{options.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
    <h3>Etapas em ordem de execução</h3>{value.steps.map((step, index) => <fieldset key={index}><legend>Etapa {index + 1}</legend><label>Nome<input required value={step.name} onChange={e => onChange({ ...value, steps: value.steps.map((s, i) => i === index ? { ...s, name: e.target.value } : s) })} /></label><label>Setores responsáveis<select multiple value={step.departments} onChange={e => onChange({ ...value, steps: value.steps.map((s, i) => i === index ? { ...s, departments: Array.from(e.target.selectedOptions).map(o => o.value) } : s) })}>{options.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Prazo em horas<input type="number" min={1} max={87600} value={step.hours} onChange={e => onChange({ ...value, steps: value.steps.map((s, i) => i === index ? { ...s, hours: Number(e.target.value) } : s) })} /></label><label><input type="checkbox" checked={step.decision} onChange={e => onChange({ ...value, steps: value.steps.map((s, i) => i === index ? { ...s, decision: e.target.checked } : s) })} /> Permite decisão final</label><button type="button" onClick={() => onChange({ ...value, steps: value.steps.filter((_, i) => i !== index) })}>Remover etapa</button></fieldset>)}
    <button className="btn" type="button" onClick={() => onChange({ ...value, steps: [...value.steps, { name: "", departments: [], hours: 24, decision: false }] })}>Adicionar etapa</button>
    <h3>Formulário</h3>{value.fields.map((field, index) => <fieldset key={index}>
      <legend>Campo {index + 1}</legend>
      <label>Chave<input required pattern="[a-z][a-zA-Z0-9_]{0,49}" value={field.key} onChange={e => updateField(index, { key: e.target.value })} /></label>
      <label>Rótulo<input required value={field.label} onChange={e => updateField(index, { label: e.target.value })} /></label>
      <label>Tipo<select value={field.type} onChange={e => updateField(index, { type: e.target.value as Field["type"] })}>{Object.entries({ text: "Texto curto", textarea: "Texto longo", number: "Número decimal", integer: "Número inteiro", date: "Data", select: "Lista de seleção", radio: "Escolha única", checkbox: "Múltipla escolha", cpfCnpj: "CPF/CNPJ", cep: "CEP", phone: "Telefone", currency: "Moeda" }).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
      <label><input type="checkbox" checked={field.required} onChange={e => updateField(index, { required: e.target.checked })} /> Obrigatório</label>
      <label>Ajuda<input value={field.help} onChange={e => updateField(index, { help: e.target.value })} /></label>
      <label>Texto de orientação no campo<input maxLength={500} value={field.placeholder ?? ""} onChange={e => updateField(index, { placeholder: e.target.value })} /></label>
      {["text", "textarea"].includes(field.type) && <>
        <label>Mínimo de caracteres<input type="number" min={0} max={field.maxLength ?? 5000} value={field.minLength ?? ""} onChange={e => updateField(index, { minLength: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
        <label>Máximo de caracteres<input type="number" min={Math.max(1, field.minLength ?? 1)} max={5000} value={field.maxLength ?? ""} onChange={e => updateField(index, { maxLength: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
      </>}
      {["select", "radio", "checkbox"].includes(field.type) && <label>Opções (separadas por vírgula)<input value={field.options.join(",")} onChange={e => updateField(index, { options: e.target.value.split(",") })} /></label>}
      <label>Exibir quando o campo<select value={field.condition?.field ?? ""} onChange={e => updateField(index, { condition: e.target.value ? { ...field.condition, field: e.target.value, equals: field.condition?.equals ?? "" } : undefined })}><option value="">Sempre visível</option>{value.fields.filter((_, i) => i !== index).map(f => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}</select></label>
      {field.condition && <>
        <label>Comparação<select value={field.condition.operator ?? "eq"} onChange={e => updateField(index, { condition: { ...field.condition!, operator: e.target.value as NonNullable<Field["condition"]>["operator"] } })}>{Object.entries({ eq: "Igual a", neq: "Diferente de", gt: "Maior que", gte: "Maior ou igual", lt: "Menor que", lte: "Menor ou igual", contains: "Contém opção ou texto", in: "Está entre os valores separados por |" }).map(([operator, label]) => <option key={operator} value={operator}>{label}</option>)}</select></label>
        <label>Valor de comparação<input value={field.condition.equals} onChange={e => updateField(index, { condition: { ...field.condition!, equals: e.target.value } })} /></label>
      </>}
      <button type="button" onClick={() => onChange({ ...value, fields: value.fields.filter((_, i) => i !== index) })}>Remover campo</button>
    </fieldset>)}
    {!!value.fields.length && <fieldset><legend>Prévia do formulário</legend><WorkflowPreview fields={value.fields} /></fieldset>}
    <button type="button" className="btn" onClick={() => onChange({ ...value, fields: [...value.fields, { key: `campo${value.fields.length + 1}`, label: "", type: "text", required: false, options: [], help: "" }] })}>Adicionar campo</button><label>Tipos de anexo obrigatórios (um por linha)<textarea value={value.requiredFiles.join("\n")} onChange={e => onChange({ ...value, requiredFiles: e.target.value.split("\n").filter(Boolean) })} /></label>
  </fieldset>;
}

function WorkflowPreview({ fields }: { fields: Field[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  return <div>{fields.filter(field => !field.calculation && conditionMatches(field, values)).map(field => <WorkflowField key={field.key} field={field} preview value={values[field.key] ?? ""} onChange={value => setValues(current => ({ ...current, [field.key]: value }))} />)}</div>;
}
