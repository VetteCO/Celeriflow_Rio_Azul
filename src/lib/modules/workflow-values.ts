import { channelAllows, fieldState, isPresentation, validateWorkflowFields, workflowDefaults, type FieldChannel, type Workflow } from "./domain";

/** One write policy for staff, identified citizens and anonymous submissions. */
export function workflowValues(workflow: Workflow, submitted: Record<string, string>, options: {
  channel: FieldChannel; previous?: Record<string, string>; afterProtocol?: boolean;
  validate?: boolean; now?: Date;
}) {
  const { channel, previous, afterProtocol = false, validate = true, now } = options;
  const defaults = workflowDefaults(workflow.fields, {}, channel, now);
  const values = { ...defaults, ...previous };
  // Ordinary family fields are filtered/validated by the caller. Unknown historic
  // values survive updates, but cannot create a new dynamic field definition.
  for (const [key, value] of Object.entries(submitted)) if (!workflow.fields.some(field => field.key === key)) values[key] = value;
  const prospective = { ...values, ...submitted };
  for (const field of workflow.fields) {
    const state = fieldState(field, prospective, channel, afterProtocol);
    const supplied = submitted[field.key];
    const protectedValue = previous?.[field.key] ?? defaults[field.key] ?? "";
    if (isPresentation(field)) { if (supplied) throw new Error(`${field.label}: elemento de apresentação não recebe valor.`); continue; }
    if (!state.visible && channelAllows(field, channel) && !afterProtocol && !field.locked && !field.calculation) {
      if (previous?.[field.key] === undefined) delete values[field.key];
      continue;
    }
    if (!state.editable) {
      // Calculated input is never trusted; it is recomputed below.
      if (!field.calculation && supplied !== undefined && supplied !== protectedValue && supplied !== "") throw new Error(`${field.label}: campo não autorizado para edição neste canal ou situação.`);
      if (supplied === "" && previous?.[field.key]) throw new Error(`${field.label}: o valor protegido não pode ser removido.`);
      if (previous?.[field.key] !== undefined) values[field.key] = previous[field.key];
      else if (!channelAllows(field, channel)) delete values[field.key];
    } else if (supplied !== undefined) values[field.key] = supplied;
  }
  if (validate) validateWorkflowFields(workflow, values, channel);
  return values;
}
