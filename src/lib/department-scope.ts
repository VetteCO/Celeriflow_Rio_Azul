import type { Role } from "./rbac";

export function effectiveDepartmentIds(primary: string | null, secondary: string[], roles: Role[], active: { id: string; parentId: string | null }[]) {
  const ids = new Set([primary, ...secondary].filter((id): id is string => !!id && active.some(d => d.id === id)));
  if (roles.includes("AUDITOR")) active.forEach(d => ids.add(d.id));
  else if (roles.includes("NIVEL_1")) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const d of active) if (d.parentId && ids.has(d.parentId) && !ids.has(d.id)) { ids.add(d.id); changed = true; }
    }
  }
  return Array.from(ids);
}
