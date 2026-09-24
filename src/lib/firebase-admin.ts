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
  return getAuth(adminApp()).verifyIdToken(idToken);
}

export async function setRoleClaim(uid: string, role: "ADMIN_GERAL" | "NIVEL_3_VISUALIZACAO") {
  return getAuth(adminApp()).setCustomUserClaims(uid, { role });
}
