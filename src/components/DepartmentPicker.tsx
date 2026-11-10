"use client";
export type PickDepartment = { id: string; name: string; parentId?: string | null; active?: boolean };
export function DepartmentPicker({ departments, value, onChange, disabled = false }: { departments: PickDepartment[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const active = departments.filter(d => d.active !== false);
  const visited = new Set<string>();
  const rows: Array<PickDepartment & { depth: number }> = [];
  function visit(d: PickDepartment, depth: number) {
    if (visited.has(d.id)) return; visited.add(d.id); rows.push({ ...d, depth });
    active.filter(child => child.parentId === d.id).forEach(child => visit(child, depth + 1));
  }
  active.filter(d => !d.parentId || !active.some(p => p.id === d.parentId)).forEach(d => visit(d, 0));
  active.forEach(d => visit(d, 0));
  return <fieldset disabled={disabled} className="card plain"><legend>Organograma — setores destinatários ({value.length})</legend>
    <div className="form-row"><button type="button" className="btn" onClick={() => onChange(active.map(d => d.id))}>Selecionar todos</button><button type="button" className="btn" onClick={() => onChange([])}>Limpar seleção</button></div>
    {rows.map(d => <label key={d.id} style={{ display: "flex", gap: 8, marginLeft: d.depth * 20, fontWeight: 400 }}><input type="checkbox" style={{ width: "auto", minHeight: "auto" }} checked={value.includes(d.id)} onChange={() => onChange(value.includes(d.id) ? value.filter(id => id !== d.id) : [...value, d.id])} />{d.name}</label>)}
  </fieldset>;
}
