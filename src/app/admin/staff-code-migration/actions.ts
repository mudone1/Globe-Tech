"use server";

import {
  migrateStaffCodes,
  previewStaffCodeMigration,
  resendStaffCodeCorrectionNotifications,
  repairReferralLinksForCorrectedStaff,
  type MigrationResult,
  type ResendNotificationsResult,
  type RepairReferralLinksResult,
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
