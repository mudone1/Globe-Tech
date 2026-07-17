import "server-only";
import { customAlphabet } from "nanoid";
import { getAdminDb } from "@/lib/firebase-admin";
import type { LinkTokenRecord } from "@/lib/types";

// Unambiguous alphabet — no 0/O, 1/I/l confusion — since staff will read tokens aloud.
const tokenAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
export const generateToken = customAlphabet(tokenAlphabet, 8);

/**
 * Resolves a public /apply/[token] URL segment to the real staffId, entirely
 * server-side. The browser and URL never see the staffId itself.
 *
 * Returns null (never throws) if the token is missing, malformed, or doesn't
 * resolve — callers should fall back to "unassigned" rather than blocking
 * the applicant, per the build plan's graceful-fallback requirement.
 */
export async function resolveStaffIdFromToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;

  try {
    const snap = await getAdminDb().collection("linkTokens").doc(token).get();
    if (!snap.exists) return null;

    const data = snap.data() as LinkTokenRecord;
    return data.staffId ?? null;
  } catch (err) {
    console.error("resolveStaffIdFromToken failed:", err);
    return null;
  }
}

/**
 * Generates a token for a staffId if one doesn't already exist, and returns
 * it. Tokens are created once and never regenerated for an existing staffId
 * (per the build plan), so a previously shared link keeps working.
 */
export async function getOrCreateTokenForStaff(staffId: string): Promise<string> {
  const existing = await getAdminDb()
    .collection("linkTokens")
    .where("staffId", "==", staffId)
    .limit(1)
    .get();

  if (!existing.empty) {
    return existing.docs[0]!.id;
  }

  // Collision check is cheap at this volume; retry on the rare clash.
  let token = generateToken();
  while ((await getAdminDb().collection("linkTokens").doc(token).get()).exists) {
    token = generateToken();
  }

  await getAdminDb()
    .collection("linkTokens")
    .doc(token)
    .set({
      token,
      staffId,
      createdAt: new Date().toISOString(),
    } satisfies LinkTokenRecord);

  return token;
}
