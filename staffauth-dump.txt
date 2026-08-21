import "server-only";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { rowToStaffRecord } from "@/lib/supabaseMappers";
import type { StaffRecord } from "@/lib/types";

/**
 * Resolves a login identifier (either an email address or a Staff ID) to
 * the email address Supabase Auth needs to sign in with. Supabase Auth has
 * no native "sign in by arbitrary ID" — Staff IDs are looked up server-side
 * against the staff table instead.
 */
export async function resolveLoginEmail(
  identifier: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const trimmed = identifier.trim();
  if (!trimmed) return { ok: false, error: "Enter your email or Staff ID." };

  // Looks like an email — use it directly, no DB lookup needed.
  if (trimmed.includes("@")) {
    return { ok: true, email: trimmed.toLowerCase() };
  }

  // Otherwise treat it as a Staff ID.
  const { data, error } = await getAdminSupabase().from("staff").select("*").eq("staff_id", trimmed).maybeSingle();
  if (error || !data) {
    return { ok: false, error: "No staff record found for that Staff ID." };
  }
  if (!data.auth_user_id) {
    return { ok: false, error: "This Staff ID doesn't have an account yet — sign up first." };
  }
  if (!data.email) {
    return { ok: false, error: "No email is on file for this Staff ID. Contact your admin." };
  }
  return { ok: true, email: data.email };
}

export interface RegisterStaffInput {
  staffId: string;
  email: string;
  password: string;
}

export type RegisterStaffResult = { ok: true; email: string } | { ok: false; error: string };

/**
 * Self-registration: verifies the Staff ID exists in the staff table and (if
 * an email is already on file for it) that the email matches, then creates
 * the Supabase Auth account and links it via staff.auth_user_id — downstream
 * code (verifyStaffSession) looks the staff row up BY that link rather than
 * trusting anything the client asserts, same trust model Firebase's custom
 * claims gave us, without needing custom claims at all.
 */
export async function registerStaffAccount(input: RegisterStaffInput): Promise<RegisterStaffResult> {
  const staffId = input.staffId.trim();
  const email = input.email.trim().toLowerCase();
  const { password } = input;

  if (!staffId || !email || !password) {
    return { ok: false, error: "Fill in your Staff ID, email, and password." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const db = getAdminSupabase();
  const { data: staffRow, error: fetchErr } = await db.from("staff").select("*").eq("staff_id", staffId).maybeSingle();
  if (fetchErr || !staffRow) {
    return { ok: false, error: "No staff record found for that Staff ID. Check it's typed exactly as given to you." };
  }
  if (staffRow.auth_user_id) {
    return { ok: false, error: "This Staff ID already has an account. Try logging in, or use Forgot password." };
  }
  if (staffRow.email && staffRow.email.trim().toLowerCase() !== email) {
    return { ok: false, error: "That email doesn't match our records for this Staff ID. Contact your admin if this seems wrong." };
  }

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { displayName: staffRow.full_name },
  });
  if (createErr || !created?.user) {
    if (createErr?.message?.toLowerCase().includes("already been registered") || createErr?.message?.toLowerCase().includes("already exists")) {
      return { ok: false, error: "That email is already registered. Try logging in instead." };
    }
    console.error("createUser failed:", createErr);
    return { ok: false, error: "Couldn't create your account. Please try again." };
  }

  await db.from("staff").update({ auth_user_id: created.user.id, email }).eq("staff_id", staffId);

  return { ok: true, email };
}

export interface StaffSession {
  uid: string;
  staffId: string;
  staff: StaffRecord;
}

/**
 * Verifies a Supabase access token (passed up from the client after
 * supabase.auth.getSession()) and returns the caller's staffId — trusted
 * because it's resolved server-side via the staff table's auth_user_id link
 * to the verified token's user, not anything the client asserted directly —
 * plus their current staff record.
 */
export async function verifyStaffSession(
  accessToken: string
): Promise<{ ok: true; session: StaffSession } | { ok: false; error: string }> {
  try {
    const db = getAdminSupabase();
    const { data: userData, error: userErr } = await db.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return { ok: false, error: "Your session has expired. Please sign in again." };
    }

    const { data: staffRow, error: staffErr } = await db.from("staff").select("*").eq("auth_user_id", userData.user.id).maybeSingle();
    if (staffErr || !staffRow) {
      return { ok: false, error: "This account isn't linked to a Staff ID." };
    }

    return {
      ok: true,
      session: { uid: userData.user.id, staffId: staffRow.staff_id, staff: rowToStaffRecord(staffRow) },
    };
  } catch (err) {
    console.error("verifyStaffSession failed:", err);
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }
}
