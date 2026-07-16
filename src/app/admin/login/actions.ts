"use server";

import { resolveLoginEmail, verifyStaffSession } from "@/lib/staffAuth";

export async function resolveLogin(identifier: string) {
  return resolveLoginEmail(identifier);
}

export type StaffActiveCheck =
  | { ok: true; active: true }
  | { ok: true; active: false; error: string }
  | { ok: false; error: string };

/**
 * Called right after a successful Firebase sign-in for a non-admin user, to
 * block a self-registered Regional Coordinator from reaching the dashboard
 * until an admin approves their account. Firebase Auth itself has no
 * concept of "pending" — this check has to happen at the app level.
 */
export async function checkStaffActiveAfterLogin(idToken: string): Promise<StaffActiveCheck> {
  const verified = await verifyStaffSession(idToken);
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
