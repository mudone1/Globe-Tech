"use server";

import { verifyStaffSession } from "@/lib/staffAuth";
import { getDownline, getStatsForStaffIds, getApplicantSummariesForStaffIds, type StaffStats, type ApplicantSummary } from "@/lib/downline";
import { PHASE2_STATUS_INFO } from "@/lib/phase2Status";
import type { StaffRecord } from "@/lib/types";

export interface DashboardMember {
  staffId: string;
  fullName: string;
  tier: string;
  link: string;
  submissions: number;
  completed: number;
  conversionRate: number;
}

export interface DashboardApplicant {
  applicationId: string;
  applicantName: string;
  businessName: string;
  grantCategoryName: string;
  statusLabel: string;
}

export interface DashboardData {
  ok: true;
  self: DashboardMember;
  downline: DashboardMember[];
  applicants: DashboardApplicant[];
}

export interface DashboardError {
  ok: false;
  error: string;
}

function toMember(staff: StaffRecord, stats: StaffStats | undefined): DashboardMember {
  return {
    staffId: staff.staffId,
    fullName: staff.fullName,
    tier: staff.tier,
    link: stats?.link || "(link not generated yet)",
    submissions: stats?.submissions ?? 0,
    completed: stats?.completed ?? 0,
    conversionRate: stats?.conversionRate ?? 0,
  };
}

function statusLabelFor(a: ApplicantSummary): string {
  if (a.status === "phase2_marked_complete") return "Completed";
  if (a.phase2VerificationStatus) return PHASE2_STATUS_INFO[a.phase2VerificationStatus as keyof typeof PHASE2_STATUS_INFO].label;
  if (!a.phase2Unlocked) return "Phase 2 · Pending (Available in 48 Hours)";
  return "Phase 2 · Awaiting account details";
}

export async function getMyDashboardData(idToken: string): Promise<DashboardData | DashboardError> {
  const verified = await verifyStaffSession(idToken);
  if (!verified.ok) return { ok: false, error: verified.error };

  const { session } = verified;
  const downlineStaff = await getDownline(session.staffId);
  const allIds = [session.staffId, ...downlineStaff.map((s) => s.staffId)];
  const [stats, applicantSummaries] = await Promise.all([
    getStatsForStaffIds(allIds),
    getApplicantSummariesForStaffIds(allIds),
  ]);

  return {
    ok: true,
    self: toMember(session.staff, stats.get(session.staffId)),
    downline: downlineStaff
      .map((s) => toMember(s, stats.get(s.staffId)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    applicants: applicantSummaries
      .map((a) => ({
        applicationId: a.applicationId,
        applicantName: a.applicantName,
        businessName: a.businessName,
        grantCategoryName: a.grantCategoryName,
        statusLabel: statusLabelFor(a),
      }))
      .sort((a, b) => a.applicantName.localeCompare(b.applicantName)),
  };
}
