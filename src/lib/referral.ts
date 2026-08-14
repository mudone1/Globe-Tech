import "server-only";
import { customAlphabet } from "nanoid";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { linkTokenToRow } from "@/lib/supabaseMappers";
import type { ReferralLinkSettingsRecord } from "@/lib/types";

// Unambiguous alphabet — no 0/O, 1/I/l confusion — since staff will read tokens aloud.
const tokenAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
export const generateToken = customAlphabet(tokenAlphabet, 8);

/**
 * Resolves a token to a staffId, or throws if the lookup itself fails (as
 * opposed to the token simply not resolving to anyone). Callers that need to
 * tell "no referrer" apart from "couldn't check right now" — e.g. to avoid
 * silently mislabeling an application "unassigned" when the real cause is a
 * database outage — should use this instead of resolveStaffIdFromToken below.
 */
export async function resolveStaffIdFromTokenStrict(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await getAdminSupabase().from("link_tokens").select("staff_id").eq("token", token).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.staff_id ?? null;
}

/**
 * Resolves a public /apply/[token] URL segment to the real staffId, entirely
 * server-side. The browser and URL never see the staffId itself.
 *
 * Returns null (never throws) if the token is missing, malformed, or doesn't
 * resolve — callers should fall back to "unassigned" rather than blocking
 * the applicant, per the build plan's graceful-fallback requirement. Use
 * resolveStaffIdFromTokenStrict instead if the caller needs to distinguish
 * a genuine non-match from a failed lookup (e.g. to avoid mislabeling
 * applications "unassigned" during a database outage).
 */
export async function resolveStaffIdFromToken(token: string | undefined | null): Promise<string | null> {
  try {
    return await resolveStaffIdFromTokenStrict(token);
  } catch (err) {
    console.error("resolveStaffIdFromToken failed:", err);
    return null;
  }
}

/**
 * Whether this token has been manually flagged isTest — visits and
 * applications through it still work exactly like any other link, but get
 * excluded from analytics. Never throws — defaults to false.
 */
export async function isTokenFlaggedTest(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    const { data } = await getAdminSupabase().from("link_tokens").select("is_test").eq("token", token).maybeSingle();
    return Boolean(data?.is_test);
  } catch (err) {
    console.error("isTokenFlaggedTest failed:", err);
    return false;
  }
}

/**
 * Generates a token for a staffId if one doesn't already exist, and returns
 * it. Tokens are created once and never regenerated for an existing staffId,
 * so a previously shared link keeps working.
 */
export async function getOrCreateTokenForStaff(staffId: string): Promise<string> {
  const db = getAdminSupabase();
  const { data: existing } = await db.from("link_tokens").select("token").eq("staff_id", staffId).limit(1).maybeSingle();
  if (existing) return existing.token;

  // Collision check is cheap at this volume; retry on the rare clash.
  let token = generateToken();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: clash } = await db.from("link_tokens").select("token").eq("token", token).maybeSingle();
    if (!clash) break;
    token = generateToken();
  }

  await db.from("link_tokens").insert(
    linkTokenToRow({ token, staffId, createdAt: new Date().toISOString() })
  );

  return token;
}

/**
 * Whether staff referral links are currently hidden on the dashboard —
 * toggled from /admin/settings. Defaults to hidden if the settings row has
 * never been written, so a fresh deploy of this feature doesn't accidentally
 * expose links before an admin has made a deliberate choice either way.
 */
export async function areReferralLinksHidden(): Promise<boolean> {
  try {
    const { data, error } = await getAdminSupabase().from("app_settings").select("*").eq("id", "referralLinks").maybeSingle();
    if (error || !data) return true;
    return (data as unknown as { links_hidden: boolean }).links_hidden ?? true;
  } catch (err) {
    console.error("areReferralLinksHidden failed:", err);
    return true;
  }
}

export type { ReferralLinkSettingsRecord };
