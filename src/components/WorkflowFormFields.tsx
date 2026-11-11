"use client";
import { useEffect, useRef, useState } from "react";
import { computeWorkflowValues, fieldState, workflowDefaults, type FamilyField, type FieldChannel } from "@/lib/modules/domain";
import { WorkflowField } from "./WorkflowField";

export function WorkflowFormFields({ fields, values, onChange, channel = "INTERNO", afterProtocol = false, preview = false, readOnly = false }: {
  fields: FamilyField[]; values: Record<string, string>; onChange: (values: Record<string, string>) => void;
  channel?: FieldChannel; afterProtocol?: boolean; preview?: boolean; readOnly?: boolean;
}) {
  const [now] = useState(() => new Date()), [status, setStatus] = useState("");
  const latest = useRef({ values, fields, onChange }); latest.current = { values, fields, onChange };
  const request = useRef<AbortController>();
  useEffect(() => () => request.current?.abort(), []);
  const effective = readOnly ? values : workflowDefaults(fields, values, channel, now);
  useEffect(() => {
    if (!readOnly && JSON.stringify(effective) !== JSON.stringify(values)) onChange(effective);
  }, [effective, values, onChange, readOnly]);
  const display = { ...effective };
  try { computeWorkflowValues(fields, display, channel); } catch { /* Incomplete operands remain editable. The server validates the final result. */ }
  async function change(field: FamilyField, value: string) {
    const updated = { ...latest.current.values, [field.key]: value }; onChange(updated);
    if (!field.addressMapping) return;
    request.current?.abort();
    const cep = value.replace(/\D/g, ""); if (cep.length !== 8) { setStatus(""); return; }
    const controller = new AbortController(); request.current = controller; setStatus("Consultando endereço…");
    try {
      const response = await fetch(`/api/cep?cep=${cep}`, { signal: controller.signal }); const address = await response.json();
      if (!response.ok) throw new Error(address.error || "Não foi possível consultar o endereço.");
      if (controller.signal.aborted || latest.current.values[field.key]?.replace(/\D/g, "") !== cep || !latest.current.fields.includes(field)) return;
      const next = { ...latest.current.values };
      for (const [source, target] of Object.entries(field.addressMapping)) {
        const definition = latest.current.fields.find(f => f.key === target);
        if (target && definition && fieldState(definition, next, channel, afterProtocol).editable && next[target] === updated[target]) next[target] = String(address[source] ?? "");
      }
      latest.current.onChange(next); setStatus("Endereço consultado. Confira os dados antes de enviar.");
    } catch (error) { if (!controller.signal.aborted) setStatus(`${(error as Error).message} Preencha o endereço manualmente.`); }
  }
  return <div className="workflow-fields">{fields.map(field => {
    const state = fieldState(field, display, channel, afterProtocol); if (!state.visible) return null;
    return <div className={`workflow-field workflow-width-${field.width ?? "100"}`} key={field.key}><WorkflowField field={{ ...field, required: state.required }} value={display[field.key] ?? ""} onChange={value => void change(field, value)} preview={preview} disabled={readOnly || !state.editable} /></div>;
  })}{status && <p role="status" className="workflow-field workflow-width-100">{status}</p>}</div>;
}
