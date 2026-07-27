import "server-only";
import { migrateStaffCodes, previewStaffCodeMigration, type MigrationResult } from "@/lib/staffCodeMigration";

export async function previewMigration(): Promise<MigrationResult> {
  return previewStaffCodeMigration();
}

export async function executeMigration(): Promise<MigrationResult> {
  return migrateStaffCodes();
}
