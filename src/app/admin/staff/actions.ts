"use server";

import { getAdminSupabase } from "@/lib/supabase-admin";

export type ApprovalResult = { ok: true } | { ok: false; error: string };

/** Approves a self-registered Regional Coordinator, making their account active. */
export async function approvePendingStaff(staffId: string): Promise<ApprovalResult> {
  try {
    const { error } = await getAdminSupabase()
      .from("staff")
      .update({ active: true, pending_approval: false })
      .eq("staff_id", staffId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    console.error("approvePendingStaff failed:", err);
    return { ok: false, error: "Couldn't approve this account. Please try again." };
  }
}

/** Rejects a self-registered Regional Coordinator signup, removing the record entirely. */
export async function rejectPendingStaff(staffId: string): Promise<ApprovalResult> {
  try {
    const { error } = await getAdminSupabase().from("staff").delete().eq("staff_id", staffId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    console.error("rejectPendingStaff failed:", err);
    return { ok: false, error: "Couldn't remove this signup. Please try again." };
  }
}
