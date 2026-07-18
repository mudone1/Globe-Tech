"use server";

import { registerNewStaff, type RegisterNewStaffInput, type RegisterNewStaffResult } from "@/lib/selfRegistration";
import { uploadIdCardToDrive, describeDriveUploadError } from "@/lib/googleDrive";

export async function submitStaffRegistration(input: RegisterNewStaffInput): Promise<RegisterNewStaffResult> {
  return registerNewStaff(input);
}

export type UploadIdCardResult = { ok: true; url: string; fileName: string } | { ok: false; error: string };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB, matching the source form's limit

export async function uploadIdCard(formData: FormData): Promise<UploadIdCardResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Choose a file first." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That file is too large — max 10MB." };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Upload a JPG, PNG, or PDF file." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadIdCardToDrive(buffer, file.name, file.type);
    return { ok: true, url: result.webViewLink, fileName: file.name };
  } catch (err) {
    console.error("uploadIdCard failed:", err);
    return { ok: false, error: describeDriveUploadError(err) };
  }
}
