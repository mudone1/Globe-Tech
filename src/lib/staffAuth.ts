import "server-only";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { staffDocId } from "@/lib/staffId";
import type { StaffRecord } from "@/lib/types";

/**
 * Resolves a login identifier (either an email address or a Staff ID) to
 * the email address Firebase Auth needs to sign in with. Firebase Auth has
 * no native "sign in by arbitrary ID" — Staff IDs are looked up server-side
 * against the synced staff record instead.
 */
export async function resolveLoginEmail(
  identifier: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const trimmed = identifier.trim();
  if (!trimmed) return { ok: false, error: "Enter your email or Staff ID." };

  // Looks like an email — use it directly, no Firestore lookup needed.
  if (trimmed.includes("@")) {
    return { ok: true, email: trimmed.toLowerCase() };
  }

  // Otherwise treat it as a Staff ID.
  const snap = await getAdminDb().collection("staff").doc(staffDocId(trimmed)).get();
  if (!snap.exists) {
    return { ok: false, error: "No staff record found for that Staff ID." };
  }
  const staff = snap.data() as StaffRecord;
  if (!staff.authUid) {
    return { ok: false, error: "This Staff ID doesn't have an account yet — sign up first." };
  }
  if (!staff.email) {
    return {
      ok: false,
      error: "No email is on file for this Staff ID. Contact your admin.",
    };
  }
  return { ok: true, email: staff.email };
}

export interface RegisterStaffInput {
  staffId: string;
  email: string;
  password: string;
}

export type RegisterStaffResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

/**
 * Self-registration: verifies the Staff ID exists in the synced staff
 * collection and (if an email is already on file for it) that the email
 * matches, then creates the Firebase Auth account and tags it with the
 * staffId as a custom claim so downstream code can trust request.auth
 * without needing a client-supplied staffId.
 */
export async function registerStaffAccount(
  input: RegisterStaffInput
): Promise<RegisterStaffResult> {
  const staffId = input.staffId.trim();
  const email = input.email.trim().toLowerCase();
  const { password } = input;

  if (!staffId || !email || !password) {
    return { ok: false, error: "Fill in your Staff ID, email, and password." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const db = getAdminDb();
  const staffRef = db.collection("staff").doc(staffDocId(staffId));
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    return {
      ok: false,
      error: "No staff record found for that Staff ID. Check it's typed exactly as given to you.",
    };
  }

  const staff = staffSnap.data() as StaffRecord;
  if (staff.authUid) {
    return {
      ok: false,
      error: "This Staff ID already has an account. Try logging in, or use Forgot password.",
    };
  }
  if (staff.email && staff.email.trim().toLowerCase() !== email) {
    return {
      ok: false,
      error: "That email doesn't match our records for this Staff ID. Contact your admin if this seems wrong.",
    };
  }

  const auth = getAdminAuth();
  let uid: string;
  try {
    const userRecord = await auth.createUser({ email, password, displayName: staff.fullName });
    uid = userRecord.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/email-already-exists") {
      return { ok: false, error: "That email is already registered. Try logging in instead." };
    }
    console.error("createUser failed:", err);
    return { ok: false, error: "Couldn't create your account. Please try again." };
  }

  await auth.setCustomUserClaims(uid, { staffId, tier: staff.tier });
  await staffRef.set({ authUid: uid, email }, { merge: true });

  return { ok: true, email };
}

export interface StaffSession {
  uid: string;
  staffId: string;
  staff: StaffRecord;
}

/**
 * Verifies a Firebase ID token (passed up from the client after
 * auth.currentUser.getIdToken()) and returns the caller's staffId — trusted
 * because it comes from the verified token's custom claims, not anything
 * the client asserted directly — plus their current staff record.
 */
export async function verifyStaffSession(
  idToken: string
): Promise<{ ok: true; session: StaffSession } | { ok: false; error: string }> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const staffId = decoded.staffId as string | undefined;
    if (!staffId) {
      return { ok: false, error: "This account isn't linked to a Staff ID." };
    }
    const snap = await getAdminDb().collection("staff").doc(staffDocId(staffId)).get();
    if (!snap.exists) {
      return { ok: false, error: "Staff record not found." };
    }
    return { ok: true, session: { uid: decoded.uid, staffId, staff: snap.data() as StaffRecord } };
  } catch (err) {
    console.error("verifyStaffSession failed:", err);
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }
}
