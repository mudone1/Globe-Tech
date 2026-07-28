"use server";

import {
  migrateStaffCodes,
  previewStaffCodeMigration,
  resendStaffCodeCorrectionNotifications,
  repairReferralLinksForCorrectedStaff,
  repairAuthClaimsForCorrectedStaff,
  type MigrationResult,
  type ResendNotificationsResult,
  type RepairReferralLinksResult,
  type RepairAuthClaimsResult,
} from "@/lib/staffCodeMigration";

export async function previewMigration(): Promise<MigrationResult> {
  return previewStaffCodeMigration();
}

export async function executeMigration(): Promise<MigrationResult> {
  return migrateStaffCodes();
}

export async function resendNotifications(): Promise<ResendNotificationsResult> {
  return resendStaffCodeCorrectionNotifications();
}

export async function repairReferralLinks(): Promise<RepairReferralLinksResult> {
  return repairReferralLinksForCorrectedStaff();
}

export async function repairAuthClaims(): Promise<RepairAuthClaimsResult> {
  return repairAuthClaimsForCorrectedStaff();
}
