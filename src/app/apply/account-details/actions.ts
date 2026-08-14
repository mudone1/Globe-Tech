"use server";

import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPhase2Unlocked, phase2UnlocksAt, PHASE2_STATUS_INFO } from "@/lib/phase2Verification";
import { getGrantCategory } from "@/lib/grantCategories";
import { isLikelyPersonName, ACCOUNT_NAME_ERROR } from "@/lib/validation";
import { rowToApplicationRecord } from "@/lib/supabaseMappers";

export type ContinuationStatus =
  | {
      ok: true;
      applicantName: string;
      businessName: string;
      grantCategoryName: string;
      grantCode: string;
      unlocked: boolean;
      unlocksAt: string;
      accountDetailsSubmitted: boolean;
      isVerified: boolean;
      verificationLabel?: string;
      verificationDescription?: string;
    }
  | { ok: false; error: string };

export async function getContinuationStatus(applicationId: string): Promise<ContinuationStatus> {
  try {
    const { data, error } = await getAdminSupabase().from("applications").select("*").eq("application_id", applicationId).maybeSingle();
    if (error || !data) {
      return { ok: false, error: "We couldn't find that application. Double-check the link from your email." };
    }
    const app = rowToApplicationRecord(data);
    const unlocked = isPhase2Unlocked(app.phase1SubmittedAt);
    const info = app.phase2VerificationStatus ? PHASE2_STATUS_INFO[app.phase2VerificationStatus] : undefined;

    return {
      ok: true,
      applicantName: app.applicantName,
      businessName: app.businessName,
      grantCategoryName: getGrantCategory(app.grantCategory).name,
      grantCode: app.grantCode,
      unlocked,
      unlocksAt: phase2UnlocksAt(app.phase1SubmittedAt).toISOString(),
      accountDetailsSubmitted: Boolean(app.accountDetailsSubmittedAt),
      isVerified: app.phase2VerificationStatus === "completed",
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
  if (!isLikelyPersonName(name)) return { ok: false, error: ACCOUNT_NAME_ERROR };

  try {
    const db = getAdminSupabase();
    const { data, error } = await db.from("applications").select("*").eq("application_id", applicationId).maybeSingle();
    if (error || !data) return { ok: false, error: "We couldn't find that application." };
    const app = rowToApplicationRecord(data);

    if (!isPhase2Unlocked(app.phase1SubmittedAt)) {
      return { ok: false, error: "Phase 2 isn't unlocked yet — check back after the 48-hour window." };
    }
    if (app.accountDetailsSubmittedAt) {
      return { ok: false, error: "You've already submitted your account details." };
    }

    const { error: updateErr } = await db
      .from("applications")
      .update({
        bank_account_number: num,
        bank_account_name: name,
        account_details_submitted_at: new Date().toISOString(),
        phase2_verification_status: "awaiting_verification",
      })
      .eq("application_id", applicationId);
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  } catch (err) {
    console.error("submitAccountDetails failed:", err);
    return { ok: false, error: "Something went wrong submitting your details. Please try again." };
  }
}
