import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Inside Cloud Functions, the Admin SDK auto-discovers credentials —
// no service account JSON needed here (unlike the Next.js app, which runs
// outside Google's infrastructure and needs FIREBASE_SERVICE_ACCOUNT_KEY).
export const app = getApps().length ? getApps()[0]! : initializeApp();
export const db = getFirestore(app);
