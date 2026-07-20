import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import { GRANT_CATEGORIES } from "@/lib/grantCategories";
import { isPhase2Unlocked } from "@/lib/phase2Status";
import type { StaffRecord, ApplicationRecord, LinkTokenRecord } from "@/lib/types";

/**
 * Walks the "Reports To Code" hierarchy from a given staffId downward,
 * breadth-first. A Regional Coordinator's downline includes their State
 * Coordinators and, transitively, those State Coordinators' Marketing
 * Officers. A depth cap guards against any unexpected cycle in the sheet
 * data — the real hierarchy is only 2 levels deep beneath any node.
 */
export async function getDownline(staffId: string, maxDepth = 4): Promise<StaffRecord[]> {
  const db = getAdminDb();
  const result: StaffRecord[] = [];
  const seen = new Set<string>([staffId]);
  let frontier = [staffId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const snap = await db.collection("staff").where("reportsToCode", "in", frontier.slice(0, 30)).get();
    const nextFrontier: string[] = [];
    snap.forEach((doc) => {
      const staff = doc.data() as StaffRecord;
      if (seen.has(staff.staffId)) return;
      seen.add(staff.staffId);
      result.push(staff);
      nextFrontier.push(staff.staffId);
    });
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
  const db = getAdminDb();

  function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  const results: ApplicantSummary[] = [];
  for (const group of chunk(staffIds, 30)) {
    const snap = await db.collection("applications").where("referredBy", "in", group).get();
    snap.forEach((doc) => {
      const app = doc.data() as ApplicationRecord;
      const category = GRANT_CATEGORIES.find((c) => c.id === app.grantCategory);
      results.push({
        applicationId: app.applicationId,
        applicantName: app.applicantName,
        businessName: app.businessName,
        grantCategoryName: category?.name ?? app.grantCategory,
        referredBy: app.referredBy,
        status: app.status,
        phase2VerificationStatus: app.phase2VerificationStatus,
        phase2Unlocked: isPhase2Unlocked(app.phase1SubmittedAt),
        createdAt: app.createdAt,
      });
    });
  }
  return results;
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
 * one pass. Firestore's "in" operator caps at 30 values, so this chunks
 * larger sets — comfortably enough for a coordinator's downline.
 */
export async function getStatsForStaffIds(staffIds: string[]): Promise<Map<string, StaffStats>> {
  const db = getAdminDb();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const stats = new Map<string, StaffStats>();
  for (const id of staffIds) {
    stats.set(id, { staffId: id, link: "", submissions: 0, completed: 0, conversionRate: 0 });
  }
  if (staffIds.length === 0) return stats;

  function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  for (const group of chunk(staffIds, 30)) {
    const [appsSnap, tokensSnap] = await Promise.all([
      db.collection("applications").where("referredBy", "in", group).get(),
      db.collection("linkTokens").where("staffId", "in", group).get(),
    ]);

    appsSnap.forEach((doc) => {
      const app = doc.data() as ApplicationRecord;
      const entry = stats.get(app.referredBy);
      if (!entry) return;
      entry.submissions++;
      if (app.status === "phase2_marked_complete") entry.completed++;
    });

    tokensSnap.forEach((doc) => {
      const token = doc.data() as LinkTokenRecord;
      const entry = stats.get(token.staffId);
      if (!entry) return;
      entry.link = `${appUrl}/apply/${token.token}`;
    });
  }

  for (const entry of stats.values()) {
    entry.conversionRate = entry.submissions ? Math.round((entry.completed / entry.submissions) * 100) : 0;
  }

  return stats;
}
