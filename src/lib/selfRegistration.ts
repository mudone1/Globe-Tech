import "server-only";
import { customAlphabet } from "nanoid";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOrCreateTokenForStaff } from "@/lib/referral";
import { staffRecordToRow, staffSetupTokenToRow } from "@/lib/supabaseMappers";
import { ROLE_CONFIGS, type SignupRole } from "@/lib/staffRoles";
import type { StaffRecord, StaffSetupTokenRecord } from "@/lib/types";

const setupTokenAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const generateSetupToken = customAlphabet(setupTokenAlphabet, 24);

/**
 * Generates staff codes using the fixed suffix format (e.g. "GBT07R/115545925"):
 * GBT + 2-digit sequence (how many staff of this tier exist already) +
 * tier letter + "/" + fixed 9-digit suffix (115545925). The sequence number
 * is cosmetic (mirrors the historical format) — uniqueness is guaranteed by
 * the tier+sequence combination and collision check below.
 */
async function generateStaffCode(tier: string, letter: string): Promise<string> {
  const db = getAdminSupabase();
  const { count, error } = await db.from("staff").select("*", { count: "exact", head: true }).eq("tier", tier);
  if (error) throw new Error(error.message);
  const seq = String((count ?? 0) + 1).padStart(2, "0");

  const fixedSuffix = "115545925";
  const candidate = `GBT${seq}${letter}/${fixedSuffix}`;

  const { data: existing } = await db.from("staff").select("staff_id").eq("staff_id", candidate).maybeSingle();
  if (!existing) return candidate;

  throw new Error(
    `Staff code collision: ${candidate} already exists. This should be vanishingly rare. ` +
    `Contact an administrator if you see this error.`
  );
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
  stateToCoordinate?: string;
  roleSpecialization?: string;
  stateOfInfluence?: string;
}

export type RegisterNewStaffResult =
  | { ok: true; staffId: string; setupToken: string; pendingApproval: boolean }
  | { ok: false; error: string };

export interface RegisterNewStaffSimplifiedInput {
  fullName: string;
  email: string;
  phone: string;
  state: string;
  homeAddress: string;
  ninNumber: string;
  mouAccepted: boolean;
  declarationAccepted: boolean;
  referrerCode?: string;
}

/**
 * Simplified registration for flat referral-based model. All new users
 * register as Marketing Officers with optional referrer. No role selection,
 * no approval flow — always active immediately.
 */
export async function registerNewStaffSimplified(
  input: RegisterNewStaffSimplifiedInput
): Promise<RegisterNewStaffResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const state = input.state.trim();
  const homeAddress = input.homeAddress.trim();
  const ninNumber = (input.ninNumber ?? "").trim();

  if (!fullName || !email || !phone || !state || !homeAddress || !ninNumber) {
    return { ok: false, error: "Fill in all required fields (name, email, phone, address, state, NIN)." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!input.mouAccepted || !input.declarationAccepted) {
    return { ok: false, error: "You must acknowledge the MOU and declaration." };
  }

  const db = getAdminSupabase();

  const { data: existingByEmail } = await db.from("staff").select("staff_id").eq("email", email).limit(1);
  if (existingByEmail && existingByEmail.length > 0) {
    return { ok: false, error: "An account already exists with that email." };
  }

  let reportsToCode: string | undefined;
  let reportsToName: string | undefined;

  const referrerCode = (input.referrerCode ?? "").trim();
  if (referrerCode) {
    const { data: referrer } = await db.from("staff").select("*").eq("staff_id", referrerCode).limit(1).maybeSingle();
    if (!referrer) {
      return { ok: false, error: "That Staff ID wasn't found. Check it and try again." };
    }
    if (!referrer.active) {
      return { ok: false, error: "That Staff ID isn't active yet." };
    }
    reportsToCode = referrer.staff_id;
    reportsToName = referrer.full_name;
  }

  const staffId = await generateStaffCode("Marketing Officer", "M");
  const now = new Date().toISOString();

  const record: StaffRecord = {
    staffId,
    fullName,
    tier: "Marketing Officer",
    email,
    phone,
    state,
    homeAddress,
    active: true,
    sourceRow: 0,
    registrationSource: "self",
    mouAccepted: input.mouAccepted,
    declarationAccepted: input.declarationAccepted,
    ninNumber,
    registeredAt: now,
    ...(reportsToCode ? { reportsToCode } : {}),
    ...(reportsToName ? { reportsToName } : {}),
  };

  const { error: insertErr } = await db.from("staff").insert(staffRecordToRow(record));
  if (insertErr) return { ok: false, error: "Couldn't create your staff record. Please try again." };

  await getOrCreateTokenForStaff(staffId);

  const setupToken = generateSetupToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString();
  const tokenRecord: StaffSetupTokenRecord = { token: setupToken, staffId, createdAt: now, expiresAt, used: false };
  await db.from("staff_setup_tokens").insert(staffSetupTokenToRow(tokenRecord));

  return { ok: true, staffId, setupToken, pendingApproval: false };
}

/**
 * Creates a brand-new staff record directly, validating the referrer code
 * against the hierarchy rules for that role, then generates a setup token
 * for the "set password" step that follows.
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

  const db = getAdminSupabase();

  const { data: existingByEmail } = await db.from("staff").select("staff_id").eq("email", email).limit(1);
  if (existingByEmail && existingByEmail.length > 0) {
    return { ok: false, error: "An account already exists with that email. Try logging in instead." };
  }

  let reportsToCode: string | undefined;
  let reportsToName: string | undefined;

  if (config.referrerTier) {
    const referrerCode = (input.referrerCode ?? "").trim();
    if (!referrerCode) {
      return { ok: false, error: `Enter ${(config.referrerLabel ?? "a referrer code").toLowerCase()}.` };
    }
    const { data: referrer } = await db.from("staff").select("*").eq("staff_id", referrerCode).limit(1).maybeSingle();
    if (!referrer) {
      return { ok: false, error: "That staff code wasn't found. Double-check it and try again." };
    }
    if (referrer.tier !== config.referrerTier) {
      return { ok: false, error: `That code belongs to a ${referrer.tier}, not a ${config.referrerTier}.` };
    }
    if (!referrer.active) {
      return { ok: false, error: "That staff code isn't active yet — ask them to confirm their account is approved." };
    }
    reportsToCode = referrer.staff_id;
    reportsToName = referrer.full_name;
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

  const { error: insertErr } = await db.from("staff").insert(staffRecordToRow(record));
  if (insertErr) return { ok: false, error: "Couldn't create your staff record. Please try again." };

  await getOrCreateTokenForStaff(staffId);

  const setupToken = generateSetupToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(); // 48h to set a password
  const tokenRecord: StaffSetupTokenRecord = { token: setupToken, staffId, createdAt: now, expiresAt, used: false };
  await db.from("staff_setup_tokens").insert(staffSetupTokenToRow(tokenRecord));

  return { ok: true, staffId, setupToken, pendingApproval };
}

export type ResolveSetupTokenResult =
  | { ok: true; staffId: string; fullName: string; tier: string; active: boolean }
  | { ok: false; error: string };

export async function resolveSetupToken(token: string): Promise<ResolveSetupTokenResult> {
  const db = getAdminSupabase();
  const { data: tokenRow } = await db.from("staff_setup_tokens").select("*").eq("token", token).maybeSingle();
  if (!tokenRow) return { ok: false, error: "This setup link is invalid. Please sign up again." };

  if (tokenRow.used) return { ok: false, error: "This setup link has already been used. Try logging in instead." };
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This setup link has expired. Please sign up again." };
  }

  const { data: staffRow } = await db.from("staff").select("*").eq("staff_id", tokenRow.staff_id).maybeSingle();
  if (!staffRow) return { ok: false, error: "We couldn't find your staff record. Please sign up again." };

  if (staffRow.auth_user_id) {
    return { ok: false, error: "This account already has a password set. Try logging in instead." };
  }

  return { ok: true, staffId: staffRow.staff_id, fullName: staffRow.full_name, tier: staffRow.tier, active: staffRow.active };
}

export type SetPasswordResult = { ok: true; email: string } | { ok: false; error: string };

export async function setPasswordForStaff(token: string, password: string): Promise<SetPasswordResult> {
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const resolved = await resolveSetupToken(token);
  if (!resolved.ok) return resolved;

  const db = getAdminSupabase();
  const { data: staffRow } = await db.from("staff").select("*").eq("staff_id", resolved.staffId).maybeSingle();
  if (!staffRow) return { ok: false, error: "We couldn't find your staff record. Please sign up again." };

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: staffRow.email,
    password,
    email_confirm: true,
    user_metadata: { displayName: staffRow.full_name },
  });
  if (createErr || !created?.user) {
    if (createErr?.message?.toLowerCase().includes("already been registered") || createErr?.message?.toLowerCase().includes("already exists")) {
      return { ok: false, error: "That email is already registered. Try logging in instead." };
    }
    console.error("setPasswordForStaff: createUser failed:", createErr);
    return { ok: false, error: "Couldn't create your account. Please try again." };
  }

  await db.from("staff").update({ auth_user_id: created.user.id }).eq("staff_id", staffRow.staff_id);
  await db.from("staff_setup_tokens").update({ used: true }).eq("token", token);

  return { ok: true, email: staffRow.email };
}
