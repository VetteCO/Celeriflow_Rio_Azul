// Auth backend Fase 1 — extrai Firebase ID token do header Authorization
// e resolve { uid, role } via custom claims. 401 sem token, 403 sem permissão.
import { verifyIdToken } from "@/lib/firebase-admin";
import { can, type Role } from "@/lib/rbac";

export type Session = { uid: string; role?: Role; email?: string };

export async function getSession(req: Request): Promise<Session | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = (await verifyIdToken(token)) as {
      uid: string;
      role?: Role;
      email?: string;
    };
    return { uid: decoded.uid, role: decoded.role, email: decoded.email };
  } catch {
    return null;
  }
}

export function requirePerm(
  session: Session | null,
  action: string
): { ok: true; session: Session } | { ok: false; status: 401 | 403 } {
  if (!session) return { ok: false, status: 401 };
  if (!can(session.role, action)) return { ok: false, status: 403 };
  return { ok: true, session };
}
