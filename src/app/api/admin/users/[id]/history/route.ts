import { NextResponse } from "next/server";
import { db } from "@/db";
import { appUser, auditLog } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canManageUser } from "@/lib/user-administration";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [target] = await db.select().from(appUser).where(eq(appUser.id, id));
  if (!target || (session.userId !== id && !await canManageUser(session, target))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const events = await db.select({ id: auditLog.id, actorId: auditLog.actorId, action: auditLog.action, at: auditLog.createdAt, metadata: auditLog.metadata }).from(auditLog)
    .where(and(eq(auditLog.entityType, "app_user"), eq(auditLog.entityId, id), inArray(auditLog.action, ["USER_PROVISIONED", "USER_UPDATED", "USER_ROLE_CHANGED", "SELF_PROFILE_UPDATED", "USER_INACTIVITY_SUSPENDED", "USER_EMAIL_CONFIRMED"])))
    .orderBy(asc(auditLog.createdAt), asc(auditLog.id));
  const actors = await db.select({ id: appUser.id, name: appUser.name }).from(appUser);
  return NextResponse.json({ events: events.map(event => ({ ...event, actor: actors.find(actor => actor.id === event.actorId)?.name ?? "Sistema" })) }, { headers: { "cache-control": "private, no-store" } });
}
