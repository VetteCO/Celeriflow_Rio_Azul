"use client";
import { useId } from "react";
import { MaskedInput } from "./MaskedInput";
import { checkboxValues, type FamilyField } from "@/lib/modules/domain";

export function WorkflowField({ field, value, onChange, preview = false, disabled = false }: { field: FamilyField; value: string; onChange: (value: string) => void; preview?: boolean; disabled?: boolean }) {
  const id = useId();
  const title = `${field.label}${field.required ? " *" : ""}`;
  // Configured help images are original resources, not application image proxies.
  // eslint-disable-next-line @next/next/no-img-element
  const image = field.helpImage ? <img src={field.helpImage} alt={`Orientação: ${field.label}`} referrerPolicy="no-referrer" style={{ display: "block", maxWidth: "100%", maxHeight: 240 }} /> : null;
  const help = field.help || image ? <span id={`${id}-help`}><small>{field.help}</small>{image}</span> : null;
  const common = { id, disabled, required: !preview && !disabled && field.required, value, placeholder: field.placeholder, minLength: preview ? undefined : field.minLength, maxLength: preview ? undefined : field.maxLength, "aria-describedby": help ? `${id}-help` : undefined };
  if (field.type === "heading" || field.type === "paragraph") {
    const p = field.presentation;
    const style = { whiteSpace: "pre-wrap" as const, textAlign: p?.align, fontSize: p?.size, fontWeight: p?.bold ? "bold" : undefined, fontStyle: p?.italic ? "italic" : undefined, textDecoration: p?.underline ? "underline" : undefined };
    return <div>{field.type === "heading" ? <h3 style={style}>{field.label}</h3> : <p style={style}>{field.label}</p>}{help}</div>;
  }
  if (field.type === "radio" || field.type === "checkbox") {
    let selected: string[] = [];
    if (field.type === "checkbox") { try { selected = checkboxValues(value); } catch { /* Keep malformed old values visible as an empty selection. */ } }
    return <fieldset><legend>{title}</legend>{field.options?.map((option, index) => <label key={option}>
      <input type={field.type} disabled={disabled} name={id} value={option} checked={field.type === "radio" ? value === option : selected.includes(option)} required={!preview && !disabled && field.required && (field.type === "radio" || (!selected.length && index === 0))} onChange={event => onChange(field.type === "radio" ? option : JSON.stringify(event.target.checked ? [...selected, option] : selected.filter(item => item !== option)))} />{option}
    </label>)}{help}</fieldset>;
  }
  return <label htmlFor={id}>{title}
    {field.type === "select" ? <select {...common} onChange={event => onChange(event.target.value)}><option value="">Selecione</option>{field.options?.map(option => <option key={option}>{option}</option>)}</select>
      : field.type === "textarea" ? <textarea {...common} rows={4} onChange={event => onChange(event.target.value)} />
        : ["cpfCnpj", "cep", "phone", "currency"].includes(field.type ?? "") ? <MaskedInput {...common} kind={field.type as "cpfCnpj" | "cep" | "phone" | "currency"} onValueChange={onChange} />
          : <input {...common} type={field.type === "date" ? "date" : field.type === "number" || field.type === "integer" ? "number" : "text"} step={!preview && field.type === "integer" ? "1" : "any"} onChange={event => onChange(event.target.value)} />}
    {help}
  </label>;
}
