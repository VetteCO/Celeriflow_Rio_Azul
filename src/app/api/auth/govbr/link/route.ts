// Vincula a identidade gov.br (simulada ou real) ao login Firebase atual:
// grava cpf + externalAuthId no app_user + auditoria GOVBR_LINKED.
// A partir daí o /admin exibe o selo "gov.br verificada".
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appUser, auditLog } from "@/db/schema";
import { getSession, requirePerm } from "@/lib/auth";

const Schema = z.object({
  cpf: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().length(11)),
  name: z.string().min(3).max(200),
});

export async function POST(req: Request) {
  const session = await getSession(req);
  // Qualquer usuário logado pode vincular a PRÓPRIA conta.
  const check = requirePerm(session, "doc:view");
  if (!check.ok)
    return NextResponse.json(
      { error: check.status === 401 ? "unauthorized" : "forbidden" },
      { status: check.status }
    );

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "cpf/nome inválidos" }, { status: 400 });

  const rows = await db
    .select()
    .from(appUser)
    .then((r) => r.find((u) => u.firebaseUid === check.session.uid));
  if (!rows)
    return NextResponse.json({ error: "usuário não cadastrado" }, { status: 404 });

  // CPF já vinculado a outra conta? Bloqueia (1 CPF = 1 conta).
  const clash = await db
    .select()
    .from(appUser)
    .then((r) =>
      r.find((u) => u.externalAuthId === parsed.data.cpf && u.id !== rows.id)
    );
  if (clash)
    return NextResponse.json(
      { error: "este CPF já está vinculado a outra conta" },
      { status: 409 }
    );

  await db
    .update(appUser)
    .set({ cpf: parsed.data.cpf, externalAuthId: parsed.data.cpf })
    .where(eq(appUser.id, rows.id));
  await db.insert(auditLog).values({
    actorType: "USER",
    actorId: check.session.uid,
    action: "GOVBR_LINKED",
    entityType: "app_user",
    entityId: rows.id,
    metadata: { cpf: parsed.data.cpf, name: parsed.data.name },
  });
  return NextResponse.json({ ok: true });
}
