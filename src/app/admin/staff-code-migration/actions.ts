"use server";

import {
  migrateStaffCodes,
  previewStaffCodeMigration,
  resendStaffCodeCorrectionNotifications,
  type MigrationResult,
  type ResendNotificationsResult,
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
