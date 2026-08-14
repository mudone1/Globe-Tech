import "server-only";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { selectAllRows } from "@/lib/supabasePaginate";
import type { BankValidationRow, Phase2VerificationStatus } from "@/lib/types";

export { PHASE2_UNLOCK_HOURS, phase2UnlocksAt, isPhase2Unlocked, PHASE2_STATUS_INFO } from "@/lib/phase2Status";

function normalizeAccountNumber(s: string): string {
  return s.replace(/\D/g, "");
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Runs one bank-validation batch against every application currently
 * pending verification, updating each match. Called immediately after an
 * admin uploads a new batch, and safe to re-run (idempotent — matching is
 * always computed fresh from current data).
 */
export async function runVerificationBatch(rows: BankValidationRow[], batchId: string): Promise<{ matchedCount: number; partialCount: number }> {
  const db = getAdminSupabase();
  const pendingStatuses: Phase2VerificationStatus[] = ["awaiting_verification", "account_type_not_verified", "verification_failed"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await selectAllRows<any>((from, to) =>
    db.from("applications").select("*").in("phase2_verification_status", pendingStatuses).range(from, to)
  );

  const normalizedRows = rows.map((r) => ({
    accountNumber: normalizeAccountNumber(r.accountNumber),
    accountName: normalizeName(r.accountName),
  }));

  let matchedCount = 0;
  let partialCount = 0;
  const now = new Date().toISOString();

  for (const app of data) {
    if (!app.bank_account_number || !app.bank_account_name) continue;

    const appAccountNumber = normalizeAccountNumber(app.bank_account_number);
    const appAccountName = normalizeName(app.bank_account_name);

    const fullMatch = normalizedRows.some((r) => r.accountNumber === appAccountNumber && r.accountName === appAccountName);
    if (fullMatch) {
      matchedCount += 1;
      await db
        .from("applications")
        .update({
          phase2_verification_status: "completed" satisfies Phase2VerificationStatus,
          phase2_verified_at: now,
          phase2_verified_batch_id: batchId,
          status: "phase2_marked_complete",
        })
        .eq("application_id", app.application_id);
      continue;
    }

    const nameMatch = normalizedRows.some((r) => r.accountName === appAccountName);
    if (nameMatch) {
      partialCount += 1;
      await db
        .from("applications")
        .update({ phase2_verification_status: "account_type_not_verified" satisfies Phase2VerificationStatus })
        .eq("application_id", app.application_id);
      continue;
    }

    // No match at all in this batch — stays/becomes verification_failed so
    // it's automatically re-checked against the next upload.
    if (app.phase2_verification_status !== "verification_failed") {
      await db
        .from("applications")
        .update({ phase2_verification_status: "verification_failed" satisfies Phase2VerificationStatus })
        .eq("application_id", app.application_id);
    }
  }

  return { matchedCount, partialCount };
}
