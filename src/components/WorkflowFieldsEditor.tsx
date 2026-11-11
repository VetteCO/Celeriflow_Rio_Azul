"use client";
import { useState } from "react";
import { type Field, type FieldChannel } from "@/lib/modules/domain";
import { WorkflowFormFields } from "./WorkflowFormFields";

export function WorkflowFieldsEditor({ fields, initialValues, channel, afterProtocol, onSave, busy = false }: {
  fields: Field[]; initialValues: Record<string, string>; channel: FieldChannel; afterProtocol: boolean;
  onSave: (values: Record<string, string>, note: string) => Promise<void>; busy?: boolean;
}) {
  const [values, setValues] = useState(initialValues), [note, setNote] = useState(""), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  return <form className="card" onSubmit={async event => {
    event.preventDefault(); if (saving || busy) return; setSaving(true); setError("");
    try { const payload = Object.fromEntries(Object.entries(values).filter(([key]) => fields.some(field => field.key === key))); await onSave(payload, note); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }}><h2>Campos do formulário</h2><p>Somente os campos autorizados para este canal e situação podem ser alterados. As versões anteriores são preservadas.</p>{error && <p role="alert">{error}</p>}
    <WorkflowFormFields fields={fields} values={values} onChange={setValues} channel={channel} afterProtocol={afterProtocol} readOnly={saving || busy} />
    {channel === "INTERNO" && <label>Justificativa da alteração<textarea required minLength={3} value={note} onChange={e => setNote(e.target.value)} /></label>}
    <button type="submit" className="btn btn-primary" disabled={saving || busy}>{saving ? "Salvando…" : "Salvar campos autorizados"}</button>
  </form>;
}
