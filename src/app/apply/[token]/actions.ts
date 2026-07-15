"use server";

import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { resolveStaffIdFromToken, generateFirstBankReferralCode } from "@/lib/referral";
import type { ApplicationRecord } from "@/lib/types";

const REF_COOKIE = "gt_ref_token";

/**
 * Called once on page load (client useEffect) to persist the token in a
 * short-lived cookie. This is the "cookie fallback" from the architecture
 * table — it survives a refresh even if the applicant loses the URL.
 * The cookie stores the opaque token only, never the resolved staffId.
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
}

export interface SubmitApplicationInput {
  token: string;
  applicantName: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: string;
  grantAmountRequested: number;
  honeypot: string; // must arrive empty — bots fill every field
}

export interface SubmitApplicationResult {
  ok: boolean;
  error?: string;
  firstBankReferralCode?: string;
}

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<SubmitApplicationResult> {
  // Spam guard: a real applicant never sees or fills this field.
  if (input.honeypot) {
    // Pretend success so bots don't learn the honeypot worked.
    return { ok: true, firstBankReferralCode: generateFirstBankReferralCode() };
  }

  if (!input.applicantName || !input.email || !input.phone || !input.businessName) {
    return { ok: false, error: "Please fill in all required fields." };
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email);
  if (!emailOk) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  // Resolve fresh from the token — don't trust anything the client claims
  // about who referred them. Fall back to the cookie if the token itself
  // is missing (e.g. a future multi-step flow that drops the URL segment).
  let staffId = await resolveStaffIdFromToken(input.token);
  if (!staffId) {
    const store = await cookies();
    const cookieToken = store.get(REF_COOKIE)?.value;
    staffId = await resolveStaffIdFromToken(cookieToken);
  }

  const firstBankReferralCode = generateFirstBankReferralCode();
  const now = new Date().toISOString();

  const docRef = getAdminDb().collection("applications").doc();
  const record: ApplicationRecord = {
    applicationId: docRef.id,
    referredBy: staffId ?? "unassigned",
    applicantName: input.applicantName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    businessName: input.businessName.trim(),
    businessType: input.businessType.trim(),
    grantAmountRequested: Number(input.grantAmountRequested) || 0,
    status: "phase1_submitted",
    createdAt: now,
    phase1SubmittedAt: now,
    firstBankReferralCode,
  };

  await docRef.set(record);

  // Phase 3 (email + Sheets backup) is triggered by a Firestore onCreate
  // Cloud Function — see functions/src/onApplicationCreated.ts — once you've
  // supplied the Resend/SendGrid key and backup Sheet. Nothing further to
  // do here.

  return { ok: true, firstBankReferralCode };
}
