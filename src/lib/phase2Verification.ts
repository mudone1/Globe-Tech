import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { ApplicationRecord, BankValidationRow, Phase2VerificationStatus } from "@/lib/types";

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
  const db = getAdminDb();
  const pendingStatuses: Phase2VerificationStatus[] = ["awaiting_verification", "account_type_not_verified", "verification_failed"];

  const snap = await db
    .collection("applications")
    .where("phase2VerificationStatus", "in", pendingStatuses)
    .get();

  const normalizedRows = rows.map((r) => ({
    accountNumber: normalizeAccountNumber(r.accountNumber),
    accountName: normalizeName(r.accountName),
  }));

  let matchedCount = 0;
  let partialCount = 0;
  const now = new Date().toISOString();

  const batch = db.batch();
  snap.forEach((doc) => {
    const app = doc.data() as ApplicationRecord;
    if (!app.bankAccountNumber || !app.bankAccountName) return;

    const appAccountNumber = normalizeAccountNumber(app.bankAccountNumber);
    const appAccountName = normalizeName(app.bankAccountName);

    const fullMatch = normalizedRows.some((r) => r.accountNumber === appAccountNumber && r.accountName === appAccountName);
    if (fullMatch) {
      matchedCount += 1;
      batch.update(doc.ref, {
        phase2VerificationStatus: "completed" satisfies Phase2VerificationStatus,
        phase2VerifiedAt: now,
        phase2VerifiedBatchId: batchId,
        status: "phase2_marked_complete",
      });
      return;
    }

    const nameMatch = normalizedRows.some((r) => r.accountName === appAccountName);
    if (nameMatch) {
      partialCount += 1;
      batch.update(doc.ref, { phase2VerificationStatus: "account_type_not_verified" satisfies Phase2VerificationStatus });
      return;
    }

    // No match at all in this batch — stays/becomes verification_failed so
    // it's automatically re-checked against the next upload.
    if (app.phase2VerificationStatus !== "verification_failed") {
      batch.update(doc.ref, { phase2VerificationStatus: "verification_failed" satisfies Phase2VerificationStatus });
    }
  });

  await batch.commit();
  return { matchedCount, partialCount };
}
