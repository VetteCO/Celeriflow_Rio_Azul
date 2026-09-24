// Seed Fase 1 — POC-01: org + 5 setores Rio Azul + roles + permissions + usuários demo.
// Idempotente: pode rodar várias vezes (onConflictDoNothing).
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const DEPARTMENTS = [
  { name: "Secretaria Municipal de Administração", acronym: "ADM" },
  { name: "Compras e Licitações", acronym: "CPL" },
  { name: "Departamento Jurídico", acronym: "JUR" },
  { name: "Recursos Humanos", acronym: "RH" },
  { name: "Tecnologia da Informação", acronym: "TI" },
];

const ROLES = ["ADMIN_GERAL", "NIVEL_3_VISUALIZACAO"];

const PERMISSIONS = [
  "doc:create",
  "doc:edit",
  "doc:view",
  "doc:forward",
  "doc:sign",
  "circular:view",
  "public:view",
  "admin:users",
];

const USERS: Array<{
  name: string;
  email: string;
  dept: string;
  roles: string[];
}> = [
  {
    name: "Administrador Geral",
    email: "admin@rioazul.pr.gov.br",
    dept: "ADM",
    roles: ["ADMIN_GERAL"],
  },
  {
    name: "Servidor Consulta",
    email: "consulta@rioazul.pr.gov.br",
    dept: "ADM",
    roles: ["NIVEL_3_VISUALIZACAO"],
  },
  {
    name: "Servidor Compras",
    email: "compras@rioazul.pr.gov.br",
    dept: "CPL",
    roles: ["NIVEL_3_VISUALIZACAO"],
  },
  {
    name: "Servidor Jurídico",
    email: "juridico@rioazul.pr.gov.br",
    dept: "JUR",
    roles: ["NIVEL_3_VISUALIZACAO"],
  },
  {
    name: "Servidor RH",
    email: "rh@rioazul.pr.gov.br",
    dept: "RH",
    roles: ["NIVEL_3_VISUALIZACAO"],
  },
  {
    name: "Servidor TI",
    email: "ti@rioazul.pr.gov.br",
    dept: "TI",
    roles: ["NIVEL_3_VISUALIZACAO"],
  },
];

async function main() {
  // Org
  await db
    .insert(schema.organization)
    .values({ name: "Prefeitura Municipal de Rio Azul", cnpj: null })
    .onConflictDoNothing();

  // Departments
  for (const d of DEPARTMENTS) {
    const existing = await db
      .select()
      .from(schema.department)
      .then((rows) => rows.find((r) => r.acronym === d.acronym));
    if (!existing) {
      await db.insert(schema.department).values({
        name: d.name,
        acronym: d.acronym,
        active: true,
      });
    }
  }
  const depts = await db.select().from(schema.department);
  const deptByAcronym = Object.fromEntries(depts.map((d) => [d.acronym, d]));

  // Roles
  for (const name of ROLES) {
    await db.insert(schema.role).values({ name }).onConflictDoNothing();
  }
  const roles = await db.select().from(schema.role);
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r]));

  // Permissions
  for (const code of PERMISSIONS) {
    await db.insert(schema.permission).values({ code }).onConflictDoNothing();
  }

  // Users + user_role
  for (const u of USERS) {
    let row = await db
      .select()
      .from(schema.appUser)
      .then((rows) => rows.find((r) => r.email === u.email));
    if (!row) {
      const inserted = await db
        .insert(schema.appUser)
        .values({
          name: u.name,
          email: u.email,
          departmentId: deptByAcronym[u.dept]?.id ?? null,
          active: true,
        })
        .returning();
      row = inserted[0];
    }
    for (const roleName of u.roles) {
      const role = roleByName[roleName];
      if (!role || !row) continue;
      const existing = await db
        .select()
        .from(schema.userRole)
        .then((rows) =>
          rows.find((r) => r.userId === row!.id && r.roleId === role.id)
        );
      if (!existing) {
        await db
          .insert(schema.userRole)
          .values({ userId: row.id, roleId: role.id });
      }
    }
  }

  await db.insert(schema.auditLog).values({
    actorType: "SYSTEM",
    actorId: null,
    action: "SEED_FASE_1",
    entityType: "database",
    entityId: null,
    metadata: { roles: ROLES, departments: DEPARTMENTS.map((d) => d.acronym) },
  });

  const counts = {
    departments: (await db.select().from(schema.department)).length,
    roles: (await db.select().from(schema.role)).length,
    users: (await db.select().from(schema.appUser)).length,
  };
  console.log("SEED_OK " + JSON.stringify(counts));
}

main().catch((e) => {
  console.error("SEED_FAIL " + (e as Error).message);
  process.exit(1);
});
