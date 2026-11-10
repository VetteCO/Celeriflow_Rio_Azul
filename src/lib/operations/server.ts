import { db } from "@/db";
import { appUser } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
export class OperationError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function actor(req: Request, permission?: string) {
  const session = await getSession(req);
  if (!session) throw new OperationError(401, "Autenticação necessária.");
  if (permission && !requirePerm(session, permission).ok) throw new OperationError(403, "Permissão insuficiente.");
  const [user] = await db.select().from(appUser).where(and(eq(appUser.firebaseUid, session.uid), eq(appUser.active, true))).limit(1);
  if (!user) throw new OperationError(403, "Servidor ativo não encontrado.");
  return { user, session, manager: requirePerm(session, "operations:manage").ok };
}
export function failure(error: unknown) {
  if (error instanceof OperationError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: "Dados inválidos.", details: error instanceof ZodError ? error.flatten() : undefined }, { status: 400 });
  console.error("[operations]", error);
  return Response.json({ error: "Não foi possível concluir a operação. Verifique a implantação das migrações e tente novamente." }, { status: 500 });
}
export function download(data: Uint8Array | string, mime: string, name: string) {
  return new Response(typeof data === "string" ? data : new Uint8Array(data), { headers: { "Content-Type": mime, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
}
