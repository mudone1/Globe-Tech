"use server";

import { syncStaffFromSheet, type SyncResult } from "@/lib/sheetsSync";
import { getAdminDb } from "@/lib/firebase-admin";
import { staffDocId } from "@/lib/staffId";

export async function runStaffSync(): Promise<SyncResult> {
  return syncStaffFromSheet();
}

export type ApprovalResult = { ok: true } | { ok: false; error: string };

/** Approves a self-registered Regional Coordinator, making their account active. */
export async function approvePendingStaff(staffId: string): Promise<ApprovalResult> {
  try {
    await getAdminDb().collection("staff").doc(staffDocId(staffId)).set(
      { active: true, pendingApproval: false },
      { merge: true }
    );
    return { ok: true };
  } catch (err) {
    console.error("approvePendingStaff failed:", err);
    return { ok: false, error: "Couldn't approve this account. Please try again." };
  }
}

/** Rejects a self-registered Regional Coordinator signup, removing the record entirely. */
export async function rejectPendingStaff(staffId: string): Promise<ApprovalResult> {
  try {
    await getAdminDb().collection("staff").doc(staffDocId(staffId)).delete();
    return { ok: true };
  } catch (err) {
    console.error("rejectPendingStaff failed:", err);
    return { ok: false, error: "Couldn't remove this signup. Please try again." };
  }
}
