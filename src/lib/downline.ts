import "server-only";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { selectAllRows } from "@/lib/supabasePaginate";
import { rowToStaffRecord } from "@/lib/supabaseMappers";
import { GRANT_CATEGORIES } from "@/lib/grantCategories";
import { isPhase2Unlocked } from "@/lib/phase2Status";
import type { StaffRecord } from "@/lib/types";

/**
 * Walks the "Reports To Code" hierarchy from a given staffId downward,
 * breadth-first. A Regional Coordinator's downline includes their State
 * Coordinators and, transitively, those State Coordinators' Marketing
 * Officers. A depth cap guards against any unexpected cycle in the data —
 * the real hierarchy is only 2 levels deep beneath any node.
 */
export async function getDownline(staffId: string, maxDepth = 4): Promise<StaffRecord[]> {
  const db = getAdminSupabase();
  const result: StaffRecord[] = [];
  const seen = new Set<string>([staffId]);
  let frontier = [staffId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const rows = await selectAllRows<any>((from, to) =>
      db.from("staff").select("*").in("reports_to_code", frontier).range(from, to)
    );
    const nextFrontier: string[] = [];
    for (const row of rows) {
      const staff = rowToStaffRecord(row);
      if (seen.has(staff.staffId)) continue;
      seen.add(staff.staffId);
      result.push(staff);
      nextFrontier.push(staff.staffId);
    }
    frontier = nextFrontier;
    depth++;
  }

  return result;
}

export interface ApplicantSummary {
  applicationId: string;
  applicantName: string;
  businessName: string;
  grantCategoryName: string;
  referredBy: string;
  phone: string;
  status: string;
  phase2VerificationStatus?: string;
  phase2Unlocked: boolean;
  createdAt: string;
}

/**
 * Curated, non-sensitive view of applicants referred by a set of staffIds —
 * used by the personal staff dashboard so Regional/State/Marketing can see
 * verification progress (and phone number, for follow-up) without ever
 * touching bank account numbers/names.
 *
 * Paginated via selectAllRows — PostgREST caps unpaginated queries at 1,000
 * rows by default, which silently truncated this for any staff member with
 * a large downline (discovered live: a Regional Coordinator's dashboard
 * showed exactly "1,000 submissions" against a real total of 1,754 — same
 * failure mode selectAllRows itself was originally built to fix elsewhere,
 * just missed in this function).
 */
export async function getApplicantSummariesForStaffIds(staffIds: string[]): Promise<ApplicantSummary[]> {
  if (staffIds.length === 0) return [];
  const db = getAdminSupabase();

  const rows = await selectAllRows<any>((from, to) =>
    db.from("applications").select("*").in("referred_by", staffIds).range(from, to)
  );

  return rows.map((row) => {
    const category = GRANT_CATEGORIES.find((c) => c.id === row.grant_category);
    return {
      applicationId: row.application_id,
      applicantName: row.applicant_name,
      businessName: row.business_name,
      grantCategoryName: category?.name ?? row.grant_category,
      referredBy: row.referred_by,
      phone: row.phone ?? "",
      status: row.status,
      phase2VerificationStatus: row.phase2_verification_status ?? undefined,
      phase2Unlocked: isPhase2Unlocked(row.phase1_submitted_at),
      createdAt: row.created_at,
    };
  });
}

export interface StaffStats {
  staffId: string;
  link: string;
  submissions: number;
  completed: number;
  conversionRate: number;
}

/**
 * Computes referral links and application stats for a set of staffIds in
 * one pass. Same pagination fix as above — applications query paginated
 * via selectAllRows for the same reason; link_tokens paginated too for
 * consistency, though far less likely to ever exceed 1,000 rows in
 * practice (one token per staff member).
 */
export async function getStatsForStaffIds(staffIds: string[]): Promise<Map<string, StaffStats>> {
  const db = getAdminSupabase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const stats = new Map<string, StaffStats>();
  for (const id of staffIds) {
    stats.set(id, { staffId: id, link: "", submissions: 0, completed: 0, conversionRate: 0 });
  }
  if (staffIds.length === 0) return stats;

  const [apps, tokens] = await Promise.all([
    selectAllRows<any>((from, to) =>
      db.from("applications").select("referred_by, status").in("referred_by", staffIds).range(from, to)
    ),
    selectAllRows<any>((from, to) =>
      db.from("link_tokens").select("staff_id, token").in("staff_id", staffIds).range(from, to)
    ),
  ]);

  for (const row of apps) {
    const entry = stats.get(row.referred_by);
    if (!entry) continue;
    entry.submissions++;
    if (row.status === "phase2_marked_complete") entry.completed++;
  }

  for (const row of tokens) {
    const entry = stats.get(row.staff_id);
    if (!entry) continue;
    entry.link = `${appUrl}/apply/${row.token}`;
  }

  for (const entry of stats.values()) {
    entry.conversionRate = entry.submissions ? Math.round((entry.completed / entry.submissions) * 100) : 0;
  }

  return stats;
}
