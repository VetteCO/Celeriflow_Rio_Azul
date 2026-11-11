"use client";
import { useState } from "react";
import { isPresentation, type Field } from "@/lib/modules/domain";

export function WorkflowFieldSettings({ field, fields, update }: { field: Field; fields: Field[]; update: (patch: Partial<Field>) => void }) {
  const [error, setError] = useState("");
  const others = fields.filter(f => f.key !== field.key && !isPresentation(f));
  const operators = { eq: "Igual a", neq: "Diferente de", gt: "Maior que", gte: "Maior ou igual", lt: "Menor que", lte: "Menor ou igual", contains: "Contém", in: "Entre valores separados por |" };
  const rules = field.rules ?? [];
  const changeRule = (index: number, patch: Partial<(typeof rules)[number]>) => update({ rules: rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule) });
  return <details><summary>Apresentação, acesso e regras do campo</summary>{error && <p role="alert">{error}</p>}
    <label>Visibilidade<select value={field.visibility ?? "AMBOS"} onChange={e => update({ visibility: e.target.value as Field["visibility"] })}><option value="AMBOS">Interna e externa</option><option value="INTERNO">Somente interna</option><option value="EXTERNO">Somente externa</option></select></label>
    <label>Largura no formulário<select value={field.width ?? "100"} onChange={e => update({ width: e.target.value as Field["width"] })}>{["25", "33", "50", "100"].map(width => <option key={width} value={width}>{width}%</option>)}</select></label>
    {!isPresentation(field) && <><label><input type="checkbox" checked={!!field.locked} onChange={e => update({ locked: e.target.checked })} /> Bloquear edição do valor</label>
      <label>Edição após protocolo<select value={field.editAfterProtocol ?? "NENHUM"} onChange={e => update({ editAfterProtocol: e.target.value as Field["editAfterProtocol"] })}><option value="NENHUM">Não permitir</option><option value="INTERNO">Somente servidores autorizados</option><option value="EXTERNO">Somente titular e representantes autorizados</option><option value="AMBOS">Ambos os canais autorizados</option></select></label>
      <label>Valor inicial<input maxLength={5000} value={field.initialValue ?? ""} onChange={e => update({ initialValue: e.target.value || undefined })} /></label>
      {field.type === "date" && <label><input type="checkbox" checked={!!field.defaultToday} onChange={e => update({ defaultToday: e.target.checked })} /> Preencher com a data atual de Brasília na criação</label>}</>}
    {isPresentation(field) && <fieldset><legend>Formatação do elemento</legend>{(["bold", "italic", "underline"] as const).map((key, index) => <label key={key}><input type="checkbox" checked={!!field.presentation?.[key]} onChange={e => update({ presentation: { bold: false, italic: false, underline: false, align: "left", size: 16, ...field.presentation, [key]: e.target.checked } })} />{["Negrito", "Itálico", "Sublinhado"][index]}</label>)}
      <label>Alinhamento<select value={field.presentation?.align ?? "left"} onChange={e => update({ presentation: { bold: false, italic: false, underline: false, size: 16, ...field.presentation, align: e.target.value as "left" | "center" | "right" } })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
      <label>Tamanho da fonte<input type="number" min={12} max={36} value={field.presentation?.size ?? 16} onChange={e => update({ presentation: { bold: false, italic: false, underline: false, align: "left", ...field.presentation, size: Number(e.target.value) } })} /></label>
    </fieldset>}
    <label>Imagem de ajuda HTTPS<input type="url" value={field.helpImage?.startsWith("data:") ? "" : field.helpImage ?? ""} onChange={e => update({ helpImage: e.target.value || undefined })} /></label>
    <label>Incorporar imagem de ajuda<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return; setError("");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 700000) { setError("Selecione PNG, JPEG ou WebP de até 700 KB."); return; }
      try { const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Não foi possível ler a imagem.")); reader.readAsDataURL(file); }); update({ helpImage: data }); } catch (e) { setError((e as Error).message); }
    }} /></label>{field.helpImage && <button type="button" className="btn" onClick={() => update({ helpImage: undefined })}>Remover imagem de ajuda</button>}
    {field.type === "cep" && <fieldset><legend>Preenchimento do endereço pelo CEP</legend>{Object.entries({ street: "Logradouro", district: "Bairro", city: "Cidade", state: "UF" }).map(([key, label]) => <label key={key}>{label}<select value={field.addressMapping?.[key as "street"] ?? ""} onChange={e => update({ addressMapping: { ...field.addressMapping, [key]: e.target.value || undefined } })}><option value="">Não preencher automaticamente</option>{others.filter(f => ["text", "textarea"].includes(f.type)).map(f => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}</select></label>)}</fieldset>}
    <fieldset><legend>Regras condicionais independentes</legend><p>Exibir condiciona a apresentação; ocultar tem precedência; obrigar exige valor somente quando o campo estiver visível.</p>
      {rules.map((rule, index) => <fieldset key={index}><legend>Regra {index + 1}</legend>
        <label>Ação<select value={rule.action} onChange={e => changeRule(index, { action: e.target.value as typeof rule.action })}><option value="EXIBIR">Exibir</option><option value="OCULTAR">Ocultar</option><option value="OBRIGAR">Tornar obrigatório</option></select></label>
        <label>Campo de referência<select required value={rule.condition.field} onChange={e => changeRule(index, { condition: { ...rule.condition, field: e.target.value } })}><option value="">Selecione</option>{others.map(f => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}</select></label>
        <label>Operador<select value={rule.condition.operator ?? "eq"} onChange={e => changeRule(index, { condition: { ...rule.condition, operator: e.target.value as typeof rule.condition.operator } })}>{Object.entries(operators).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Comparar com<input value={rule.condition.equals} onChange={e => changeRule(index, { condition: { ...rule.condition, equals: e.target.value } })} /></label>
        <button type="button" className="btn" onClick={() => update({ rules: rules.filter((_, i) => i !== index) })}>Remover regra</button>
      </fieldset>)}<button type="button" className="btn" disabled={rules.length >= 20 || !others.length} onClick={() => update({ rules: [...rules, { action: "OBRIGAR", condition: { field: others[0].key, equals: "", operator: "eq" } }] })}>Adicionar regra condicional</button>
    </fieldset>
  </details>;
}
