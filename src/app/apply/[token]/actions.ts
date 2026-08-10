"use server";

import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { resolveStaffIdFromToken, resolveStaffIdFromTokenStrict, isTokenFlaggedTest } from "@/lib/referral";
import { sendGrantCodeEmail } from "@/lib/email";
import { GRANT_CATEGORIES } from "@/lib/grantCategories";
import { normalizeNigerianPhone } from "@/lib/phone";
import type { ApplicationRecord, EmailLogRecord, VisitRecord, GrantCategoryId } from "@/lib/types";

const REF_COOKIE = "gt_ref_token";

/**
 * Looks up an existing application by phone number (normalized first, then
 * a raw-string fallback for records written before phoneNormalized existed).
 * One retry after a short delay absorbs a transient Firestore blip. Throws
 * if both attempts fail — callers decide how to handle that (see
 * checkExistingApplication below: deliberately fails OPEN, not closed).
 */
async function findApplicationByPhoneOnce(phone: string): Promise<ApplicationRecord | null> {
  const db = getAdminDb();
  const normalized = normalizeNigerianPhone(phone);

  if (normalized) {
    const byNormalized = await db.collection("applications").where("phoneNormalized", "==", normalized).limit(1).get();
    if (!byNormalized.empty) return byNormalized.docs[0]!.data() as ApplicationRecord;
  }

  // Fallback for pre-existing records that don't have phoneNormalized
  // backfilled yet — matches on whatever raw string the applicant typed.
  const raw = phone.trim();
  if (raw) {
    const byRaw = await db.collection("applications").where("phone", "==", raw).limit(1).get();
    if (!byRaw.empty) return byRaw.docs[0]!.data() as ApplicationRecord;
  }

  return null;
}

async function findApplicationByPhone(phone: string): Promise<ApplicationRecord | null> {
  try {
    return await findApplicationByPhoneOnce(phone);
  } catch (err) {
    console.error("findApplicationByPhone: first attempt failed, retrying once:", err);
    await new Promise((resolve) => setTimeout(resolve, 800));
    return await findApplicationByPhoneOnce(phone);
  }
}

export type CheckExistingApplicationResult = { exists: false } | { exists: true; applicationId: string };

/**
 * Called right after the applicant enters their phone number (before the
 * rest of the form), so a returning applicant gets routed to the FirstBank
 * completion page instead of starting a brand-new application.
 *
 * Fails OPEN by design: if the lookup itself can't complete (e.g. a Firestore
 * outage/quota issue), this reports "not found" rather than blocking the
 * applicant. Blocking every applicant because a duplicate-check read failed
 * is worse than occasionally missing a duplicate — a missed duplicate is
 * fully recoverable later via the /admin/application-dedup cleanup tool,
 * whereas turning away a real applicant during an outage is not recoverable
 * at all. This is a deliberate reversal of an earlier fail-closed version
 * that, in practice, blocked 100% of applicants (new and returning alike)
 * during a Firestore read-quota outage.
 */
export async function checkExistingApplication(phone: string): Promise<CheckExistingApplicationResult> {
  try {
    const existing = await findApplicationByPhone(phone);
    if (!existing) return { exists: false };
    return { exists: true, applicationId: existing.applicationId };
  } catch (err) {
    console.error("checkExistingApplication: lookup failed after retry — failing open, applicant proceeds as new:", err);
    return { exists: false };
  }
}

/**
 * Preview of the Grant Code shown before final submission, so the applicant
 * can copy/confirm it ahead of time. Uses the exact same resolution logic
 * submitApplication uses for the authoritative write — this is display-only,
 * never trusted as the actual value written to Firestore.
 */
export async function getGrantCodePreview(token: string): Promise<string> {
  let staffId = await resolveStaffIdFromToken(token);
  if (!staffId) {
    const store = await cookies();
    const cookieToken = store.get(REF_COOKIE)?.value;
    staffId = await resolveStaffIdFromToken(cookieToken);
  }
  return staffId ?? "unassigned";
}

/**
 * Called once on page load (client useEffect) to persist the token in a
 * short-lived cookie. This is the "cookie fallback" from the architecture
 * table — it survives a refresh even if the applicant loses the URL.
 * The cookie stores the opaque token only, never the resolved staffId.
 *
 * Also logs a lightweight visit record so the admin analytics dashboard can
 * show a real "link visited → application submitted" conversion rate, not
 * just submission counts. Best-effort — a failed write here never blocks
 * the applicant from continuing.
 */
export async function recordVisit(token: string) {
  const store = await cookies();
  store.set(REF_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days — long enough to cover a slow applicant, short enough to stay "short-lived"
    path: "/",
  });

  try {
    const [staffId, isTest] = await Promise.all([
      resolveStaffIdFromToken(token).then((id) => id ?? "unassigned"),
      isTokenFlaggedTest(token),
    ]);
    const record: VisitRecord = { token, staffId, visitedAt: new Date().toISOString(), ...(isTest ? { isTest: true } : {}) };
    await getAdminDb().collection("visits").add(record);
  } catch (err) {
    console.error("recordVisit: failed to log visit (non-fatal):", err);
  }
}

export interface SubmitApplicationInput {
  token: string;

  grantCategory: GrantCategoryId;
  grantAmount: number;

  // Universal
  applicantName: string;
  phone: string;
  email: string;
  stateOfResidence: string;
  businessName: string;
  grantNeedExplanation: string;

  // Trader categories (1–3) only
  businessType?: string;
  businessLocation?: string;
  monthlyProductCost?: number;

  // Enterprise/LLC categories (4–6) only
  cacNumber?: string;
  businessDescription?: string;

  declarationAgreed: boolean;

  honeypot: string; // must arrive empty — bots fill every field
}

export interface SubmitApplicationResult {
  ok: boolean;
  error?: string;
  grantCode?: string;
}

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<SubmitApplicationResult> {
  // Spam guard: a real applicant never sees or fills this field.
  if (input.honeypot) {
    // Pretend success so bots don't learn the honeypot worked.
    return { ok: true, grantCode: "GT-DEMO" };
  }

  const category = GRANT_CATEGORIES.find((c) => c.id === input.grantCategory);
  if (!category) {
    return { ok: false, error: "Select a grant category to continue." };
  }

  const requiredStrings: Array<[string, string]> = [
    ["Full name", input.applicantName],
    ["Phone number", input.phone],
    ["Email address", input.email],
    ["State of residence", input.stateOfResidence],
    ["Business name", input.businessName],
    ["Why you need this grant", input.grantNeedExplanation],
  ];

  if (category.tier === "trader") {
    requiredStrings.push(["Business type", input.businessType ?? ""], ["Business location", input.businessLocation ?? ""]);
    if (!input.monthlyProductCost || Number(input.monthlyProductCost) <= 0) {
      return { ok: false, error: "Enter your approximate monthly product cost." };
    }
  } else {
    requiredStrings.push(
      ["CAC registration number", input.cacNumber ?? ""],
      ["Business description", input.businessDescription ?? ""]
    );
  }

  for (const [label, value] of requiredStrings) {
    if (!value || !value.trim()) {
      return { ok: false, error: `Please complete: ${label}.` };
    }
  }

  if (!input.declarationAgreed) {
    return { ok: false, error: "Please confirm the final declaration to submit." };
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email);
  if (!emailOk) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const phoneOk = /^[0-9+()\-\s]{7,}$/.test(input.phone);
  if (!phoneOk) {
    return { ok: false, error: "Please enter a valid phone number." };
  }

  // Backend safety net against duplicates — the primary check already
  // happened at the phone-entry stage before this form was even shown, but
  // this guards against races and any client that bypasses that stage.
  // Fails OPEN: if the lookup itself can't complete, let the submission
  // through rather than blocking a real applicant over an unrelated
  // read-side outage — any duplicate that slips through here is fully
  // recoverable later via /admin/application-dedup.
  let existing: ApplicationRecord | null = null;
  try {
    existing = await findApplicationByPhone(input.phone);
  } catch (err) {
    console.error("submitApplication: duplicate-phone check failed — failing open, submission proceeds:", err);
  }
  if (existing) {
    return {
      ok: false,
      error: "An application already exists for this phone number. Please use the link you were sent to complete it.",
    };
  }

  // Resolve fresh from the token — don't trust anything the client claims
  // about who referred them. Fall back to the cookie if the token itself
  // is missing (e.g. a future multi-step flow that drops the URL segment).
  // Uses the strict resolver so a failed lookup (e.g. a Firestore outage)
  // is distinguishable from a token that genuinely has no referrer — a
  // failure still resolves to "unassigned" for this submission (an
  // applicant should never be blocked over this), but gets flagged via
  // referralResolutionFailed so the true referrer can be recovered later
  // instead of silently and permanently mislabeled.
  let resolvedToken = input.token;
  let staffId: string | null = null;
  let resolutionFailed = false;
  try {
    staffId = await resolveStaffIdFromTokenStrict(input.token);
  } catch (err) {
    console.error("submitApplication: referral resolution failed for URL token:", err);
    resolutionFailed = true;
  }
  if (!staffId) {
    const store = await cookies();
    const cookieToken = store.get(REF_COOKIE)?.value;
    try {
      staffId = await resolveStaffIdFromTokenStrict(cookieToken);
      if (staffId) resolutionFailed = false; // cookie fallback succeeded — no longer a failure overall
      if (staffId && cookieToken) resolvedToken = cookieToken;
    } catch (err) {
      console.error("submitApplication: referral resolution failed for cookie token:", err);
      resolutionFailed = true;
    }
  }
  const isTest = await isTokenFlaggedTest(resolvedToken).catch(() => false);

  const grantCode = staffId ?? "unassigned";
  const now = new Date().toISOString();

  const docRef = getAdminDb().collection("applications").doc();
  const record: ApplicationRecord = {
    applicationId: docRef.id,
    referredBy: staffId ?? "unassigned",
    ...(resolvedToken ? { referralToken: resolvedToken } : {}),
    ...(resolutionFailed ? { referralResolutionFailed: true } : {}),
    ...(isTest ? { isTest: true } : {}),

    grantCategory: input.grantCategory,
    grantAmount: category.amount,

    applicantName: input.applicantName.trim(),
    phone: input.phone.trim(),
    ...(normalizeNigerianPhone(input.phone) ? { phoneNormalized: normalizeNigerianPhone(input.phone)! } : {}),
    email: input.email.trim().toLowerCase(),
    stateOfResidence: input.stateOfResidence,
    businessName: input.businessName.trim(),
    grantNeedExplanation: input.grantNeedExplanation.trim(),

    ...(category.tier === "trader"
      ? {
          businessType: (input.businessType ?? "").trim(),
          businessLocation: (input.businessLocation ?? "").trim(),
          monthlyProductCost: Number(input.monthlyProductCost) || 0,
        }
      : {
          cacNumber: (input.cacNumber ?? "").trim(),
          businessDescription: (input.businessDescription ?? "").trim(),
        }),

    declarationAgreed: input.declarationAgreed,

    status: "phase1_submitted",
    createdAt: now,
    phase1SubmittedAt: now,
    grantCode,
  };

  await docRef.set(record);

  // Send the Grant Code + FirstBank account-opening guide immediately.
  // A failed send never fails the submission itself — the application is
  // already saved — it's just logged to emailLogs so it's visible to admins
  // rather than silently disappearing.
  try {
    await sendGrantCodeEmail({
      to: record.email,
      applicantName: record.applicantName,
      grantCode,
      grantCategoryName: category.name,
      grantAmount: category.amount,
      applicationId: docRef.id,
    });
    await docRef.update({ status: "phase2_email_sent" });
    await getAdminDb().collection("emailLogs").add({
      applicationId: docRef.id,
      type: "phase2_instructions",
      sentAt: new Date().toISOString(),
      opened: false,
      clicked: false,
    } satisfies EmailLogRecord);
  } catch (err) {
    console.error(`Grant Code email failed for application ${docRef.id}:`, err);
    await getAdminDb()
      .collection("emailLogs")
      .add({
        applicationId: docRef.id,
        type: "phase2_instructions",
        sentAt: new Date().toISOString(),
        opened: false,
        clicked: false,
        error: err instanceof Error ? err.message : String(err),
      } satisfies EmailLogRecord);
  }

  return { ok: true, grantCode };
}
