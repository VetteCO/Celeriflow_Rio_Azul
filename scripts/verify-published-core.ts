import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { firebaseAdminAuth } from "../src/lib/firebase-admin";

async function main() {
  const base = process.argv[2];
  assert.equal(base, "https://rioazul.celeriflow.com.br", "Explicit Rio Azul destination required");
  const sql = neon(process.env.DATABASE_URL!);
  const [admin] = await sql("SELECT u.id,u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND r.name='ADMIN_GERAL' AND u.firebase_uid IS NOT NULL ORDER BY u.id LIMIT 1");
  assert.ok(admin);
  const custom = await firebaseAdminAuth().createCustomToken(admin.firebase_uid);
  const exchange = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }), signal: AbortSignal.timeout(30000) });
  const session = await exchange.json(); assert.ok(exchange.ok && session.idToken, "Firebase exchange failed");
  async function get(path: string) {
    const response = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${session.idToken}` }, signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200, `Published ${path} status`);
    return response.json();
  }
  const me = await get("/api/admin/me"); assert.equal(me.userId, admin.id);
  const users = await get("/api/admin/users");
  const departments = await get("/api/admin/departments");
  const docs = await get("/api/documents?pageSize=20");
  const rows = await sql("SELECT id FROM app_user ORDER BY id");
  assert.deepEqual(users.users.map((user: { id: string }) => user.id).sort(), rows.map(row => row.id).sort(), "Published users differ from configured database");
  const sectors = await sql("SELECT id FROM department ORDER BY id");
  assert.deepEqual(departments.departments.map((sector: { id: string }) => sector.id).sort(), sectors.map(row => row.id).sort(), "Published sectors differ from configured database");
  console.log(JSON.stringify({ at: new Date().toISOString(), base, authenticatedSession: "PASS", usersMatchConfiguredDatabase: rows.length, departmentsMatchConfiguredDatabase: sectors.length, authorizedDocuments: docs.total }));
}
void main().catch(() => { console.error("Published core verification failed; no credentials or records printed."); process.exitCode = 1; });
