// Bootstrap de logins — cria usuários no Firebase Auth (email/senha),
// define custom claim de role e vincula ao app_user. Uso:
//   ADMIN_EMAIL=admin@email.com ADMIN_PASSWORD='Senha123!' npx tsx src/db/bootstrap-users.ts
// Idempotente: re-rodar atualiza senha/claim/vínculo.
import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

type Role = "ADMIN_GERAL" | "NIVEL_3_VISUALIZACAO";

const USERS: Array<{
  name: string;
  email: string;
  passwordEnv: string;
  dept: string | null;
  role: Role;
}> = [
  {
    name: "Admin Master",
    email: process.env.ADMIN_EMAIL ?? "admin@email.com",
    passwordEnv: "ADMIN_PASSWORD",
    dept: "ADM",
    role: "ADMIN_GERAL",
  },
  {
    name: "José Antunes",
    email: "jose.antunes@aurora.mg.gov.br",
    passwordEnv: "TEST_PASSWORD",
    dept: "ADM",
    role: "ADMIN_GERAL",
  },
  {
    name: "Maria Goulart",
    email: "maria.goulart@aurora.mg.gov.br",
    passwordEnv: "TEST_PASSWORD",
    dept: "CPL",
    role: "NIVEL_3_VISUALIZACAO",
  },
  // Elenco do ensaio (fictício, realista)
  { name: "João da Silva", email: "joaodasilva@email.com", passwordEnv: "TEST_PASSWORD", dept: "ADM", role: "ADMIN_GERAL" },
  { name: "Maria Oliveira", email: "mariaoliveira@email.com", passwordEnv: "TEST_PASSWORD", dept: "CPL", role: "NIVEL_3_VISUALIZACAO" },
  { name: "Carlos Souza", email: "carlossouza@email.com", passwordEnv: "TEST_PASSWORD", dept: "JUR", role: "NIVEL_3_VISUALIZACAO" },
  { name: "Ana Santos", email: "anasantos@email.com", passwordEnv: "TEST_PASSWORD", dept: "RH", role: "NIVEL_3_VISUALIZACAO" },
  { name: "Paulo Ferreira", email: "pauloferreira@email.com", passwordEnv: "TEST_PASSWORD", dept: "TI", role: "NIVEL_3_VISUALIZACAO" },
  { name: "Fernanda Lima", email: "fernandalima@email.com", passwordEnv: "TEST_PASSWORD", dept: "ADM", role: "NIVEL_3_VISUALIZACAO" },
];

async function main() {
  const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !pk) {
    throw new Error("Firebase Admin env ausente (CHECKPOINT 4)");
  }
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: pk,
    }),
  });
  const auth = getAuth();
  const depts = await db.select().from(schema.department);
  const roles = await db.select().from(schema.role);

  for (const u of USERS) {
    const password = process.env[u.passwordEnv];
    if (!password) throw new Error(`env ${u.passwordEnv} ausente para ${u.email}`);

    let fb;
    try {
      fb = await auth.getUserByEmail(u.email);
      await auth.updateUser(fb.uid, { password, emailVerified: true, disabled: false });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "auth/user-not-found") {
        fb = await auth.createUser({
          email: u.email,
          password,
          displayName: u.name,
          emailVerified: true,
        });
      } else throw e;
    }
    await auth.setCustomUserClaims(fb!.uid, { role: u.role });

    let row = (
      await db.select().from(schema.appUser).where(eq(schema.appUser.email, u.email))
    )[0];
    if (!row) {
      const dept = depts.find((d) => d.acronym === u.dept);
      const inserted = await db
        .insert(schema.appUser)
        .values({
          name: u.name,
          email: u.email,
          firebaseUid: fb!.uid,
          departmentId: dept?.id ?? null,
          active: true,
        })
        .returning();
      row = inserted[0]!;
    } else if (row.firebaseUid !== fb!.uid) {
      await db
        .update(schema.appUser)
        .set({ firebaseUid: fb!.uid })
        .where(eq(schema.appUser.id, row.id));
    }
    const target = roles.find((r) => r.name === u.role)!;
    await db.delete(schema.userRole).where(eq(schema.userRole.userId, row.id));
    await db.insert(schema.userRole).values({ userId: row.id, roleId: target.id });

    await db.insert(schema.auditLog).values({
      actorType: "SYSTEM",
      actorId: null,
      action: "USER_BOOTSTRAPPED",
      entityType: "app_user",
      entityId: row.id,
      metadata: { email: u.email, role: u.role, claimSynced: true },
    });
    console.log(`OK ${u.email} role=${u.role} uid=${fb!.uid}`);
  }
}

main().catch((e) => {
  console.error("BOOTSTRAP_FAIL " + (e as Error).message);
  process.exit(1);
});
