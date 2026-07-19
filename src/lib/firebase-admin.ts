import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { getStorage, Storage } from "firebase-admin/storage";

/**
 * Server-only Firebase Admin init. Never import this file from a
 * "use client" component — it will throw, and it should, because the
 * service account key must never reach the browser.
 *
 * Initialization is lazy (only happens on first call to getAdminDb/getAdminAuth)
 * so that `next build`'s page-data collection doesn't need real credentials
 * for routes that merely import this module without invoking Firestore.
 */
let app: App | undefined;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set. Add your Firebase service account JSON to .env.local (see .env.local.example)."
    );
  }

  const serviceAccount = JSON.parse(raw);
  // .env files often store the private_key with literal \n escapes — restore real newlines.
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  app = initializeApp({ credential: cert(serviceAccount) });
  return app;
}

let dbInstance: Firestore | undefined;
let authInstance: Auth | undefined;
let storageInstance: Storage | undefined;

export function getAdminDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(getAdminApp());
  return dbInstance;
}

export function getAdminAuth(): Auth {
  if (!authInstance) authInstance = getAuth(getAdminApp());
  return authInstance;
}

export function getAdminStorage(): Storage {
  if (!storageInstance) storageInstance = getStorage(getAdminApp());
  return storageInstance;
}
