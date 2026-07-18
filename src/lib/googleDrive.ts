import "server-only";
import { google } from "googleapis";
import { Readable } from "stream";

/**
 * Uploads staff ID card files (NIN/Voter's card) to a shared Google Drive folder,
 * reusing the same service account already set up for the onboarding sheet sync
 * (GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY) — this needs
 * the Drive API enabled on the same Google Cloud project, and that service
 * account given Editor access on the target folder. See README for setup.
 */
function getDriveClient() {
  const email = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      "GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY are not set. Add them in Vercel's environment variables."
    );
  }
  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Turns a Drive upload failure into a message that's actually useful —
 * "couldn't upload, try again" tells you nothing when the real cause is a
 * missing env var or a permissions mistake on the shared folder. None of
 * these messages contain secrets (env var names and Google's own API error
 * text aren't sensitive), so it's safe to show them directly.
 */
export function describeDriveUploadError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("is not set")) {
    return `Upload isn't configured yet: ${message}`;
  }
  if (message.includes("File not found") || message.includes("notFound")) {
    return "Upload failed: the destination Drive folder wasn't found — check the folder ID env var is correct and the folder still exists.";
  }
  if (message.includes("insufficient") || message.includes("403") || message.includes("permission")) {
    return "Upload failed: the service account doesn't have permission to upload to that folder — check it's shared as Editor.";
  }
  if (message.includes("invalid_grant") || message.includes("401") || message.includes("Invalid JWT")) {
    return "Upload failed: the Google service account credentials look invalid — check GOOGLE_SHEETS_PRIVATE_KEY was pasted in full, newlines and all.";
  }
  return `Couldn't upload your file: ${message}`;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

export async function uploadFileToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string
): Promise<DriveUploadResult> {
  const drive = getDriveClient();

  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
  });

  const fileId = data.id;
  if (!fileId) throw new Error("Drive upload did not return a file ID.");

  // "Anyone with the link" so admins can open it straight from the admin panel
  // without being individually added to the folder. The link itself is only
  // ever shown inside the authenticated admin UI, never publicly.
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return { fileId, webViewLink: data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view` };
}

export async function uploadIdCardToDrive(buffer: Buffer, fileName: string, mimeType: string): Promise<DriveUploadResult> {
  const folderId = process.env.GOOGLE_DRIVE_ID_CARDS_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_ID_CARDS_FOLDER_ID is not set. Add it in Vercel's environment variables.");
  }
  return uploadFileToDrive(buffer, fileName, mimeType, folderId);
}

export async function uploadCacDocumentToDrive(buffer: Buffer, fileName: string, mimeType: string): Promise<DriveUploadResult> {
  // Falls back to the ID-cards folder if a separate CAC-docs folder isn't
  // configured, so this works out of the box without a second Drive setup —
  // set GOOGLE_DRIVE_CAC_DOCS_FOLDER_ID if you'd rather keep them apart.
  const folderId = process.env.GOOGLE_DRIVE_CAC_DOCS_FOLDER_ID || process.env.GOOGLE_DRIVE_ID_CARDS_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_CAC_DOCS_FOLDER_ID (or GOOGLE_DRIVE_ID_CARDS_FOLDER_ID) is not set. Add one in Vercel's environment variables.");
  }
  return uploadFileToDrive(buffer, fileName, mimeType, folderId);
}
