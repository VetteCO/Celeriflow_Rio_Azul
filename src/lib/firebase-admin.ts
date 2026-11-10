import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function adminApp() {
  if (getApps().length) return getApps()[0]!;
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")!
    })
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
