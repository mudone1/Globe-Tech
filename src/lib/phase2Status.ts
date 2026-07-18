import type { Phase2VerificationStatus } from "@/lib/types";

export const PHASE2_UNLOCK_HOURS = 48;

export function phase2UnlocksAt(phase1SubmittedAt: string): Date {
  const d = new Date(phase1SubmittedAt);
  d.setHours(d.getHours() + PHASE2_UNLOCK_HOURS);
  return d;
}

export function isPhase2Unlocked(phase1SubmittedAt: string): boolean {
  return Date.now() >= phase2UnlocksAt(phase1SubmittedAt).getTime();
}

/**
 * Applicant-facing label + description for each verification state — the
 * plain-English text shown on the continuation page and (a subset of it) on
 * staff dashboards. Kept in one place so the wording stays consistent.
 */
export const PHASE2_STATUS_INFO: Record<Phase2VerificationStatus, { label: string; description: string }> = {
  awaiting_verification: {
    label: "Awaiting Verification",
    description: "You've submitted your account details. We're waiting on the next FirstBank validation upload to confirm them.",
  },
  account_type_not_verified: {
    label: "Account Type Not Yet Verified",
    description: "Your name matches our records, but we haven't yet been able to confirm this is your FirstBank SME account. We'll keep checking automatically against future updates — no action needed from you.",
  },
  verification_failed: {
    label: "Verification Failed",
    description: "We haven't found a matching FirstBank SME account yet in the current validation data. Please double-check the account number and name you submitted are exactly as issued by FirstBank.",
  },
  invalid_account: {
    label: "Invalid Account Submitted",
    description: "The account you submitted doesn't appear to be a valid FirstBank SME account. Please contact us to confirm your correct account details.",
  },
  completed: {
    label: "Completed",
    description: "Your FirstBank SME account has been verified. Phase 2 is complete.",
  },
};
