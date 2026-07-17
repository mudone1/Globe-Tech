"use server";

import { verifyStaffSession } from "@/lib/staffAuth";
import { getDownline, getStatsForStaffIds, type StaffStats } from "@/lib/downline";
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

export interface DashboardData {
  ok: true;
  self: DashboardMember;
  downline: DashboardMember[];
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

export async function getMyDashboardData(idToken: string): Promise<DashboardData | DashboardError> {
  const verified = await verifyStaffSession(idToken);
  if (!verified.ok) return { ok: false, error: verified.error };

  const { session } = verified;
  const downlineStaff = await getDownline(session.staffId);
  const allIds = [session.staffId, ...downlineStaff.map((s) => s.staffId)];
  const stats = await getStatsForStaffIds(allIds);

  return {
    ok: true,
    self: toMember(session.staff, stats.get(session.staffId)),
    downline: downlineStaff
      .map((s) => toMember(s, stats.get(s.staffId)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  };
}
