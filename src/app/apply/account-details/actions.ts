"use server";

import { getAdminDb } from "@/lib/firebase-admin";
import { isPhase2Unlocked, phase2UnlocksAt, PHASE2_STATUS_INFO } from "@/lib/phase2Verification";
import { getGrantCategory } from "@/lib/grantCategories";
import type { ApplicationRecord } from "@/lib/types";

export type ContinuationStatus =
  | {
      ok: true;
      applicantName: string;
      businessName: string;
      grantCategoryName: string;
      unlocked: boolean;
      unlocksAt: string;
      accountDetailsSubmitted: boolean;
      verificationLabel?: string;
      verificationDescription?: string;
    }
  | { ok: false; error: string };

export async function getContinuationStatus(applicationId: string): Promise<ContinuationStatus> {
  try {
    const snap = await getAdminDb().collection("applications").doc(applicationId).get();
    if (!snap.exists) {
      return { ok: false, error: "We couldn't find that application. Double-check the link from your email." };
    }
    const app = snap.data() as ApplicationRecord;
    const unlocked = isPhase2Unlocked(app.phase1SubmittedAt);
    const info = app.phase2VerificationStatus ? PHASE2_STATUS_INFO[app.phase2VerificationStatus] : undefined;

    return {
      ok: true,
      applicantName: app.applicantName,
      businessName: app.businessName,
      grantCategoryName: getGrantCategory(app.grantCategory).name,
      unlocked,
      unlocksAt: phase2UnlocksAt(app.phase1SubmittedAt).toISOString(),
      accountDetailsSubmitted: Boolean(app.accountDetailsSubmittedAt),
      verificationLabel: info?.label,
      verificationDescription: info?.description,
    };
  } catch (err) {
    console.error("getContinuationStatus failed:", err);
    return { ok: false, error: "Something went wrong loading your application. Please try again." };
  }
}

export async function submitAccountDetails(
  applicationId: string,
  accountNumber: string,
  accountName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const num = accountNumber.trim();
  const name = accountName.trim();
  if (!num || !name) return { ok: false, error: "Enter both your account number and account name." };

  try {
    const ref = getAdminDb().collection("applications").doc(applicationId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: "We couldn't find that application." };
    const app = snap.data() as ApplicationRecord;

    if (!isPhase2Unlocked(app.phase1SubmittedAt)) {
      return { ok: false, error: "Phase 2 isn't unlocked yet — check back after the 48-hour window." };
    }
    if (app.accountDetailsSubmittedAt) {
      return { ok: false, error: "You've already submitted your account details." };
    }

    await ref.update({
      bankAccountNumber: num,
      bankAccountName: name,
      accountDetailsSubmittedAt: new Date().toISOString(),
      phase2VerificationStatus: "awaiting_verification",
    });
    return { ok: true };
  } catch (err) {
    console.error("submitAccountDetails failed:", err);
    return { ok: false, error: "Something went wrong submitting your details. Please try again." };
  }
}
