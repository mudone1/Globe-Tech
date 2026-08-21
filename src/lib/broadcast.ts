import "server-only";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { selectAllRows } from "@/lib/supabasePaginate";
import { PENDING_STATUSES } from "@/lib/phase2Status";
import type { RecipientGroupId } from "@/lib/recipientGroups";
import type { Phase2VerificationStatus, StaffTier } from "@/lib/types";

interface RecipientGroupQuery {
  source: "applications" | "staff";
  phase2Status?: Phase2VerificationStatus;
  phase2Statuses?: Phase2VerificationStatus[];
  staffTier?: StaffTier;
}

const RECIPIENT_GROUP_QUERIES: Record<RecipientGroupId, RecipientGroupQuery> = {
  all_applicants: { source: "applications" },
  verified_completed: { source: "applications", phase2Status: "completed" },
  pending_verification: { source: "applications", phase2Statuses: PENDING_STATUSES },
  account_type_not_verified: { source: "applications", phase2Status: "account_type_not_verified" },
  verification_failed: { source: "applications", phase2Status: "verification_failed" },
  invalid_account: { source: "applications", phase2Status: "invalid_account" },
  all_staff: { source: "staff" },
  staff_regional_coordinator: { source: "staff", staffTier: "Regional Coordinator" },
  staff_state_coordinator: { source: "staff", staffTier: "State Coordinator" },
  staff_marketing_officer: { source: "staff", staffTier: "Marketing Officer" },
};

function dedupeEmails(raw: (string | null | undefined)[]): { email: string }[] {
  const seen = new Set<string>();
  const out: { email: string }[] = [];
  for (const value of raw) {
    const email = value?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email });
  }
  return out;
}

/**
 * Resolves a recipient group to a deduped list of email addresses, queried
 * fresh from applications/staff via the service-role client — nothing here
 * is ever sent to the browser except the final count (see
 * previewBroadcastRecipients in broadcast-actions.ts).
 */
export async function resolveRecipients(groupId: RecipientGroupId): Promise<{ email: string }[]> {
  const group = RECIPIENT_GROUP_QUERIES[groupId];
  if (!group) throw new Error(`Unknown recipient group: ${groupId}`);
  const db = getAdminSupabase();

  if (group.source === "applications") {
    const rows = await selectAllRows<{ email: string }>((from, to) => {
      let q = db.from("applications").select("email").range(from, to);
      if (group.phase2Statuses) q = q.in("phase2_verification_status", group.phase2Statuses);
      else if (group.phase2Status) q = q.eq("phase2_verification_status", group.phase2Status);
      return q;
    });
    return dedupeEmails(rows.map((r) => r.email));
  }

  const rows = await selectAllRows<{ email: string }>((from, to) => {
    let q = db.from("staff").select("email").range(from, to);
    if (group.staffTier) q = q.eq("tier", group.staffTier);
    return q;
  });
  return dedupeEmails(rows.map((r) => r.email));
}
