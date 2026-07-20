import "server-only";
import { customAlphabet } from "nanoid";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { staffDocId } from "@/lib/staffId";
import { getOrCreateTokenForStaff } from "@/lib/referral";
import { ROLE_CONFIGS, type SignupRole } from "@/lib/staffRoles";
import type { StaffRecord, StaffSetupTokenRecord } from "@/lib/types";

const randomDigits = customAlphabet("0123456789", 9);
const setupTokenAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const generateSetupToken = customAlphabet(setupTokenAlphabet, 24);

/**
 * Matches the existing sheet-era staff code style (e.g. "GBT07R/115545925"):
 * GBT + 2-digit sequence (how many staff of this tier exist already) +
 * tier letter + "/" + 9 random digits. The sequence number is cosmetic
 * (mirrors the historical format) — uniqueness is guaranteed by the random
 * suffix and the collision check below, not by the sequence itself.
 */
async function generateStaffCode(tier: string, letter: string): Promise<string> {
  const db = getAdminDb();
  const countSnap = await db.collection("staff").where("tier", "==", tier).count().get();
  const seq = String(countSnap.data().count + 1).padStart(2, "0");

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = `GBT${seq}${letter}/${randomDigits()}`;
    const existing = await db.collection("staff").doc(staffDocId(candidate)).get();
    if (!existing.exists) return candidate;
  }
  // Vanishingly unlikely fallback if 8 straight collisions happen — widen the random space.
  return `GBT${seq}${letter}/${randomDigits()}${randomDigits().slice(0, 3)}`;
}

export interface RegisterNewStaffInput {
  role: SignupRole;
  fullName: string;
  middleName?: string;
  email: string;
  phone: string;
  state: string;
  homeAddress: string;
  socialMediaPlatform?: string;
  socialMediaUsername?: string;
  ninNumber?: string;
  mouAccepted: boolean;
  declarationAccepted: boolean;
  referrerCode?: string;
  stateToCoordinate?: string; // State Coordinator only
  roleSpecialization?: string; // Regional Coordinator only
  stateOfInfluence?: string; // Regional Coordinator only
}

export type RegisterNewStaffResult =
  | { ok: true; staffId: string; setupToken: string; pendingApproval: boolean }
  | { ok: false; error: string };

/**
 * Creates a brand-new staff record directly (no Google Sheet involved),
 * validating the referrer code against the hierarchy rules for that role,
 * then generates a setup token for the "set password" step that follows.
 */
export async function registerNewStaff(input: RegisterNewStaffInput): Promise<RegisterNewStaffResult> {
  const config = ROLE_CONFIGS[input.role];
  if (!config) return { ok: false, error: "Unknown role." };

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const state = input.state.trim();
  const homeAddress = input.homeAddress.trim();

  const ninNumber = (input.ninNumber ?? "").trim();

  if (!fullName || !email || !phone || !state || !homeAddress || !ninNumber) {
    return { ok: false, error: "Fill in your name, email, phone, address, state, and NIN." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!input.mouAccepted) {
    return { ok: false, error: "You'll need to acknowledge all the MOU statements to continue." };
  }
  if (!input.declarationAccepted) {
    return { ok: false, error: "You'll need to confirm the declaration to continue." };
  }

  const db = getAdminDb();

  // Reject a duplicate email up front — createUser would also catch this
  // later, but this way we don't burn a generated staff code on a
  // registration that was always going to fail.
  const existingByEmail = await db.collection("staff").where("email", "==", email).limit(1).get();
  if (!existingByEmail.empty) {
    return { ok: false, error: "An account already exists with that email. Try logging in instead." };
  }

  let reportsToCode: string | undefined;
  let reportsToName: string | undefined;

  if (config.referrerTier) {
    const referrerCode = (input.referrerCode ?? "").trim();
    if (!referrerCode) {
      return { ok: false, error: `Enter ${(config.referrerLabel ?? "a referrer code").toLowerCase()}.` };
    }
    const referrerSnap = await db.collection("staff").where("staffId", "==", referrerCode).limit(1).get();
    if (referrerSnap.empty) {
      return { ok: false, error: "That staff code wasn't found. Double-check it and try again." };
    }
    const referrer = referrerSnap.docs[0]!.data() as StaffRecord;
    if (referrer.tier !== config.referrerTier) {
      return { ok: false, error: `That code belongs to a ${referrer.tier}, not a ${config.referrerTier}.` };
    }
    if (!referrer.active) {
      return { ok: false, error: "That staff code isn't active yet — ask them to confirm their account is approved." };
    }
    reportsToCode = referrer.staffId;
    reportsToName = referrer.fullName;
  }

  const staffId = await generateStaffCode(config.tier, config.codeLetter);
  const pendingApproval = config.requiresApproval;

  const record: StaffRecord = {
    staffId,
    fullName,
    tier: config.tier,
    email,
    phone,
    state,
    active: !pendingApproval,
    sourceRow: 0,
    registrationSource: "self",
    homeAddress,
    mouAccepted: input.mouAccepted,
    declarationAccepted: input.declarationAccepted,
    ...(pendingApproval ? { pendingApproval: true } : {}),
    ...(reportsToCode ? { reportsToCode } : {}),
    ...(reportsToName ? { reportsToName } : {}),
    ...(input.middleName?.trim() ? { middleName: input.middleName.trim() } : {}),
    ...(input.socialMediaPlatform?.trim() ? { socialMediaPlatform: input.socialMediaPlatform.trim() } : {}),
    ...(input.socialMediaUsername?.trim() ? { socialMediaUsername: input.socialMediaUsername.trim() } : {}),
    ninNumber,
    ...(input.stateToCoordinate?.trim() ? { stateToCoordinate: input.stateToCoordinate.trim() } : {}),
    ...(input.roleSpecialization?.trim() ? { roleSpecialization: input.roleSpecialization.trim() } : {}),
    ...(input.stateOfInfluence?.trim() ? { stateOfInfluence: input.stateOfInfluence.trim() } : {}),
  };

  await db.collection("staff").doc(staffDocId(staffId)).set(record);
  await getOrCreateTokenForStaff(staffId);

  const setupToken = generateSetupToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(); // 48h to set a password
  const tokenRecord: StaffSetupTokenRecord = {
    token: setupToken,
    staffId,
    createdAt: new Date().toISOString(),
    expiresAt,
    used: false,
  };
  await db.collection("staffSetupTokens").doc(setupToken).set(tokenRecord);

  return { ok: true, staffId, setupToken, pendingApproval };
}

export type ResolveSetupTokenResult =
  | { ok: true; staffId: string; fullName: string; tier: string; active: boolean }
  | { ok: false; error: string };

export async function resolveSetupToken(token: string): Promise<ResolveSetupTokenResult> {
  const db = getAdminDb();
  const snap = await db.collection("staffSetupTokens").doc(token).get();
  if (!snap.exists) return { ok: false, error: "This setup link is invalid. Please sign up again." };

  const record = snap.data() as StaffSetupTokenRecord;
  if (record.used) return { ok: false, error: "This setup link has already been used. Try logging in instead." };
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "This setup link has expired. Please sign up again." };
  }

  const staffSnap = await db.collection("staff").doc(staffDocId(record.staffId)).get();
  if (!staffSnap.exists) return { ok: false, error: "We couldn't find your staff record. Please sign up again." };

  const staff = staffSnap.data() as StaffRecord;
  if (staff.authUid) {
    return { ok: false, error: "This account already has a password set. Try logging in instead." };
  }

  return { ok: true, staffId: staff.staffId, fullName: staff.fullName, tier: staff.tier, active: staff.active };
}

export type SetPasswordResult = { ok: true; email: string } | { ok: false; error: string };

export async function setPasswordForStaff(token: string, password: string): Promise<SetPasswordResult> {
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const resolved = await resolveSetupToken(token);
  if (!resolved.ok) return resolved;

  const db = getAdminDb();
  const staffRef = db.collection("staff").doc(staffDocId(resolved.staffId));
  const staffSnap = await staffRef.get();
  const staff = staffSnap.data() as StaffRecord;

  const auth = getAdminAuth();
  let uid: string;
  try {
    const userRecord = await auth.createUser({ email: staff.email, password, displayName: staff.fullName });
    uid = userRecord.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/email-already-exists") {
      return { ok: false, error: "That email is already registered. Try logging in instead." };
    }
    console.error("setPasswordForStaff: createUser failed:", err);
    return { ok: false, error: "Couldn't create your account. Please try again." };
  }

  await auth.setCustomUserClaims(uid, { staffId: staff.staffId, tier: staff.tier });
  await staffRef.set({ authUid: uid }, { merge: true });
  await db.collection("staffSetupTokens").doc(token).set({ used: true }, { merge: true });

  return { ok: true, email: staff.email };
}
