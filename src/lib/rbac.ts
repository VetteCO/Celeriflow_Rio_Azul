const read = ["doc:view", "circular:view", "public:view"];
const write = [...read, "doc:create", "doc:edit", "doc:forward", "doc:receive", "doc:conclude", "doc:archive", "doc:reopen"];
export const PERMS = {
  ADMIN_GERAL: ["*"],
  ADMIN_LOCAL: [...write, "admin:users", "admin:departments"],
  NIVEL_1: [...write, "admin:users", "admin:departments"],
  NIVEL_2: [...read, "doc:create", "doc:edit", "doc:receive", "doc:forward"],
  NIVEL_3_VISUALIZACAO: read,
  AUDITOR: [...write, "operations:reports"],
} as const;
export type Role = keyof typeof PERMS;
export function can(role: Role | undefined, action: string): boolean {
  const list: readonly string[] = role ? PERMS[role] ?? [] : [];
  return list.includes("*") || list.includes(action);
}
