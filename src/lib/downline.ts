import "server-only";
import { getAdminSupabase } from "@/lib/supabase-admin";
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
 *
 * Postgres's `.in()` has no per-query item cap the way Firestore's did
 * (30 values max), so unlike the old Firestore version this never needs to
 * chunk the frontier array.
 */
export async function getDownline(staffId: string, maxDepth = 4): Promise<StaffRecord[]> {
  const db = getAdminSupabase();
  const result: StaffRecord[] = [];
  const seen = new Set<string>([staffId]);
  let frontier = [staffId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const { data, error } = await db.from("staff").select("*").in("reports_to_code", frontier);
    if (error) throw new Error(error.message);
    const nextFrontier: string[] = [];
    for (const row of data ?? []) {
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
  status: string;
  phase2VerificationStatus?: string;
  phase2Unlocked: boolean;
  createdAt: string;
}

/**
 * Curated, non-sensitive view of applicants referred by a set of staffIds —
 * used by the personal staff dashboard so Regional/State/Marketing can see
 * verification progress without ever touching bank account numbers/names
 * (those never leave this function; only the coarse status does).
 */
export async function getApplicantSummariesForStaffIds(staffIds: string[]): Promise<ApplicantSummary[]> {
  if (staffIds.length === 0) return [];
  const db = getAdminSupabase();

  const { data, error } = await db.from("applications").select("*").in("referred_by", staffIds);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const category = GRANT_CATEGORIES.find((c) => c.id === row.grant_category);
    return {
      applicationId: row.application_id,
      applicantName: row.applicant_name,
      businessName: row.business_name,
      grantCategoryName: category?.name ?? row.grant_category,
      referredBy: row.referred_by,
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
 * one pass.
 */
export async function getStatsForStaffIds(staffIds: string[]): Promise<Map<string, StaffStats>> {
  const db = getAdminSupabase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const stats = new Map<string, StaffStats>();
  for (const id of staffIds) {
    stats.set(id, { staffId: id, link: "", submissions: 0, completed: 0, conversionRate: 0 });
  }
  if (staffIds.length === 0) return stats;

  const [{ data: apps, error: appsErr }, { data: tokens, error: tokensErr }] = await Promise.all([
    db.from("applications").select("referred_by, status").in("referred_by", staffIds),
    db.from("link_tokens").select("staff_id, token").in("staff_id", staffIds),
  ]);
  if (appsErr) throw new Error(appsErr.message);
  if (tokensErr) throw new Error(tokensErr.message);

  for (const row of apps ?? []) {
    const entry = stats.get(row.referred_by);
    if (!entry) continue;
    entry.submissions++;
    if (row.status === "phase2_marked_complete") entry.completed++;
  }

  for (const row of tokens ?? []) {
    const entry = stats.get(row.staff_id);
    if (!entry) continue;
    entry.link = `${appUrl}/apply/${row.token}`;
  }

  for (const entry of stats.values()) {
    entry.conversionRate = entry.submissions ? Math.round((entry.completed / entry.submissions) * 100) : 0;
  }

  return stats;
}
