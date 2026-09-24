// POC-01 — RBAC validado no backend. Nunca confiar só em esconder botão.
export const PERMS = {
  ADMIN_GERAL: ["*"],
  NIVEL_3_VISUALIZACAO: ["doc:view", "circular:view", "public:view"]
} as const;

export type Role = keyof typeof PERMS;

export function can(role: Role | undefined, action: string): boolean {
  if (!role) return false;
  const list: readonly string[] = PERMS[role] ?? [];
  return list.includes("*") || list.includes(action);
}
