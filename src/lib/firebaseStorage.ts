import "server-only";
import { getAdminStorage } from "@/lib/firebase-admin";

/**
 * Uploads staff ID card files (NIN/Voter's card) to Firebase Storage, reusing
 * the same service account already set up for Firestore/Auth
 * (FIREBASE_SERVICE_ACCOUNT_KEY) — no separate Google Cloud setup needed.
 *
 * This replaces an earlier Google Drive-based upload, which failed with
 * "Service Accounts do not have storage quota" — personal (non-Workspace)
 * Google accounts can't grant service accounts write access to My Drive;
 * that requires a Shared Drive, which is a Workspace-only feature.
 */

export function describeStorageUploadError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("is not set")) {
    return `Upload isn't configured yet: ${message}`;
  }
  if (message.includes("does not exist") || message.includes("bucket")) {
    return "Upload failed: the Firebase Storage bucket wasn't found — check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is correct and Storage is enabled for this project.";
  }
  if (message.includes("permission") || message.includes("403") || message.includes("PERMISSION_DENIED")) {
    return "Upload failed: the service account doesn't have permission to write to Storage — check its IAM role includes Storage Object Admin.";
  }
  return `Couldn't upload your file: ${message}`;
}

export interface StorageUploadResult {
  url: string;
  path: string;
}

export async function uploadIdCardToStorage(buffer: Buffer, fileName: string, mimeType: string): Promise<StorageUploadResult> {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set. Add it in Vercel's environment variables.");
  }

  const bucket = getAdminStorage().bucket(bucketName);
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `id-cards/${Date.now()}-${safeName}`;
  const file = bucket.file(path);

  await file.save(buffer, { contentType: mimeType });
  // Public read so admins can open it straight from the admin panel without
  // extra auth plumbing — the link itself is only ever shown inside the
  // authenticated admin UI, never publicly.
  await file.makePublic();

  return { url: `https://storage.googleapis.com/${bucketName}/${path}`, path };
}
