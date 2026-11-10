"use client";
import { useId } from "react";
import { MaskedInput } from "./MaskedInput";
import { checkboxValues, type FamilyField } from "@/lib/modules/domain";

export function WorkflowField({ field, value, onChange, preview = false }: { field: FamilyField; value: string; onChange: (value: string) => void; preview?: boolean }) {
  const id = useId();
  const title = `${field.label}${field.required ? " *" : ""}`;
  const help = field.help ? <small id={`${id}-help`}>{field.help}</small> : null;
  const common = { id, required: !preview && field.required, value, placeholder: field.placeholder, minLength: preview ? undefined : field.minLength, maxLength: preview ? undefined : field.maxLength, "aria-describedby": field.help ? `${id}-help` : undefined };
  if (field.type === "radio" || field.type === "checkbox") {
    let selected: string[] = [];
    if (field.type === "checkbox") { try { selected = checkboxValues(value); } catch { /* Keep malformed old values visible as an empty selection. */ } }
    return <fieldset><legend>{title}</legend>{field.options?.map((option, index) => <label key={option}>
      <input type={field.type} name={id} value={option} checked={field.type === "radio" ? value === option : selected.includes(option)} required={!preview && field.required && (field.type === "radio" || (!selected.length && index === 0))} onChange={event => onChange(field.type === "radio" ? option : JSON.stringify(event.target.checked ? [...selected, option] : selected.filter(item => item !== option)))} />{option}
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
