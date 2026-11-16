import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function normalizePrivateKey(raw?: string): string {
  if (!raw) return "";
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  if (!key.includes("BEGIN") && /^[A-Za-z0-9+/=]+$/.test(key)) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf8");
      if (decoded.includes("BEGIN")) key = decoded;
    } catch {
      // Preserva o valor original caso não seja base64 válido.
    }
  }
  return key.replace(/\\n/g, "\n");
}

function adminApp() {
  if (getApps().length) return getApps()[0]!;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin não configurado neste ambiente.");
  }
  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export async function verifyIdToken(idToken: string) {
  return getAuth(adminApp()).verifyIdToken(idToken, true);
}

export function firebaseAdminAuth() { return getAuth(adminApp()); }

export async function setRoleClaim(uid: string, role: import("./rbac").Role) {
  const auth = firebaseAdminAuth();
  const user = await auth.getUser(uid);
  return auth.setCustomUserClaims(uid, { ...user.customClaims, role });
}
