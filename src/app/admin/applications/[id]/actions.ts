"use server";

import { getAdminSupabase } from "@/lib/supabase-admin";

export type SetReferrerResult = { ok: true; staffName: string } | { ok: false; error: string };

/**
 * Manually corrects an application's referrer/attribution — needed for
 * applications that were written with referredBy "unassigned" because the
 * token→staffId lookup failed at submission time (e.g. during a database
 * outage) rather than because the applicant genuinely had no referrer.
 * grantCode mirrors referredBy throughout this app, so both are updated
 * together to keep them consistent. Uses the service-role client because
 * referredBy/grantCode aren't in the applications RLS policy's writable
 * shape for regular clients — that's intentional (this shouldn't be
 * casually editable from the client), so the correction goes through this
 * admin-gated action instead of loosening the policy.
 */
export async function setApplicationReferrer(applicationId: string, staffId: string): Promise<SetReferrerResult> {
  const trimmed = staffId.trim();
  if (!trimmed) return { ok: false, error: "Enter a staff code." };

  const db = getAdminSupabase();

  const { data: staff } = await db.from("staff").select("*").eq("staff_id", trimmed).limit(1).maybeSingle();
  if (!staff) {
    return { ok: false, error: `No staff member found with code "${trimmed}".` };
  }

  const { data: app } = await db.from("applications").select("application_id").eq("application_id", applicationId).maybeSingle();
  if (!app) {
    return { ok: false, error: "Application not found." };
  }

  const { error: updateErr } = await db
    .from("applications")
    .update({ referred_by: trimmed, grant_code: trimmed, referral_resolution_failed: false })
    .eq("application_id", applicationId);
  if (updateErr) return { ok: false, error: "Couldn't update the referrer. Please try again." };

  return { ok: true, staffName: staff.full_name };
}
