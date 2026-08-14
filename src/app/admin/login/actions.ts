"use server";

import { resolveLoginEmail, verifyStaffSession } from "@/lib/staffAuth";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function resolveLogin(identifier: string) {
  return resolveLoginEmail(identifier);
}

export type StaffActiveCheck =
  | { ok: true; active: true }
  | { ok: true; active: false; error: string }
  | { ok: false; error: string };

/**
 * Called right after a successful sign-in for a non-admin user, to block a
 * self-registered Regional Coordinator from reaching the dashboard until an
 * admin approves their account. Supabase Auth itself has no concept of
 * "pending" — this check has to happen at the app level.
 */
export async function checkStaffActiveAfterLogin(accessToken: string): Promise<StaffActiveCheck> {
  const verified = await verifyStaffSession(accessToken);
  if (!verified.ok) return { ok: false, error: verified.error };

  if (!verified.session.staff.active) {
    return {
      ok: true,
      active: false,
      error: "Your account is pending admin approval. You'll be notified once it's approved.",
    };
  }
  return { ok: true, active: true };
}

export type ClaimPasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Shadow-verify auth cutover, step 2 of 2 (step 1 happens client-side — see
 * admin/login/page.tsx): every staff member already has a Supabase Auth
 * account (created during the bulk data migration with a random throwaway
 * password, imported alongside the rest of their data), but with a password
 * nobody knows yet.
 *
 * When a Supabase sign-in fails, the client re-verifies the entered
 * password against the OLD Firebase project directly (Firebase Auth itself
 * — not Firestore — is unaffected by the ongoing database outage this
 * migration exists because of). If THAT succeeds, this action sets that
 * same password on the already-existing Supabase account, so the client can
 * immediately retry the Supabase sign-in and succeed. No account creation
 * happens here — only the still-unknown password gets set on the account
 * the import already created. This is temporary: once every active staff
 * member has logged in at least once post-cutover, this path stops being
 * exercised and can eventually be removed along with the Firebase fallback.
 */
export async function claimSupabasePassword(email: string, password: string): Promise<ClaimPasswordResult> {
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  try {
    const db = getAdminSupabase();

    // Look up the target user via staff.auth_user_id rather than
    // auth.admin.listUsers() — that call paginates at 50 users per page by
    // default, and this project has 140+ accounts, so a client-side
    // Array.find() over just the first page would silently miss any real
    // account past #50. Every staff member's Supabase auth user was already
    // linked during the migration import, so this is both correct and a
    // single indexed lookup instead of a full user-list scan.
    const { data: staffRow, error: staffErr } = await db.from("staff").select("auth_user_id").eq("email", email.toLowerCase()).maybeSingle();
    if (staffErr) throw new Error(staffErr.message);
    if (!staffRow?.auth_user_id) return { ok: false, error: "No account found for that email." };

    const { error: updateErr } = await db.auth.admin.updateUserById(staffRow.auth_user_id, { password });
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  } catch (err) {
    console.error("claimSupabasePassword failed:", err);
    return { ok: false, error: "Couldn't finish signing you in. Please try again." };
  }
}
