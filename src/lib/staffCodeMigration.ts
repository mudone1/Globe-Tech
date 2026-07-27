import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import { staffDocId } from "@/lib/staffId";
import type { StaffRecord } from "@/lib/types";

const CORRECT_SUFFIX = "115545925";
const CORRECT_STAFF_CODE_SUFFIX = `/${CORRECT_SUFFIX}`;

export interface MigrationResult {
  success: boolean;
  totalRecords: number;
  correctedCount: number;
  referralUpdatesCount: number;
  corrections: Array<{
    originalStaffId: string;
    newStaffId: string;
    userName: string;
    affectedReferrals: number;
  }>;
  errors: string[];
}

/**
 * Validates if a staff code has the correct fixed suffix
 */
export function hasCorrectSuffix(staffId: string): boolean {
  return staffId.endsWith(CORRECT_STAFF_CODE_SUFFIX);
}

/**
 * Extracts the prefix (everything before the /) from a staff code
 */
function getStaffCodePrefix(staffId: string): string {
  const parts = staffId.split("/");
  return parts[0] || "";
}

/**
 * Corrects a staff code to use the fixed suffix
 */
function correctStaffCode(staffId: string): string {
  const prefix = getStaffCodePrefix(staffId);
  if (!prefix) throw new Error(`Invalid staff code format: ${staffId}`);
  return `${prefix}${CORRECT_STAFF_CODE_SUFFIX}`;
}

/**
 * One-time migration to fix all existing staff codes with incorrect suffixes.
 * Updates staff records and all referral relationships.
 * Provides detailed results and logging for manual review.
 */
export async function migrateStaffCodes(): Promise<MigrationResult> {
  const db = getAdminDb();
  const result: MigrationResult = {
    success: false,
    totalRecords: 0,
    correctedCount: 0,
    referralUpdatesCount: 0,
    corrections: [],
    errors: [],
  };

  try {
    // Step 1: Read all staff records
    const staffSnap = await db.collection("staff").get();
    result.totalRecords = staffSnap.size;

    if (result.totalRecords === 0) {
      result.success = true;
      result.errors.push("No staff records found in database");
      return result;
    }

    // Step 2: Identify records that need correction
    const toCorrect: Array<{ doc: FirebaseFirestore.DocumentSnapshot; record: StaffRecord }> = [];

    staffSnap.forEach((doc) => {
      const record = doc.data() as StaffRecord;
      if (!hasCorrectSuffix(record.staffId)) {
        toCorrect.push({ doc, record });
      }
    });

    if (toCorrect.length === 0) {
      result.success = true;
      result.correctedCount = 0;
      return result;
    }

    // Step 3: Create mapping of old → new staff codes for referral updates
    const codeMapping = new Map<string, string>();
    toCorrect.forEach(({ record }) => {
      const newCode = correctStaffCode(record.staffId);
      codeMapping.set(record.staffId, newCode);
    });

    // Step 4: Apply corrections and collect affected referrals
    const batch = db.batch();
    let referralUpdatesCount = 0;

    for (const { doc, record } of toCorrect) {
      const oldStaffId = record.staffId;
      const newStaffId = correctStaffCode(oldStaffId);
      const now = new Date().toISOString();

      // Delete the old document (with incorrect suffix)
      batch.delete(doc.ref);

      // Create new document (with correct suffix) with correction metadata
      const correctedRecord: StaffRecord = {
        ...record,
        staffId: newStaffId,
        staffCodeCorrected: true,
        staffCodeCorrectedAt: now,
        originalStaffId: oldStaffId,
      };
      batch.set(db.collection("staff").doc(staffDocId(newStaffId)), correctedRecord);

      result.corrections.push({
        originalStaffId: oldStaffId,
        newStaffId,
        userName: record.fullName,
        affectedReferrals: 0, // Will be updated below
      });
    }

    // Step 5: Update all referral references (reportsToCode)
    staffSnap.forEach((doc) => {
      const record = doc.data() as StaffRecord;

      if (record.reportsToCode && codeMapping.has(record.reportsToCode)) {
        const oldReportsTo = record.reportsToCode;
        const newReportsTo = codeMapping.get(oldReportsTo)!;

        batch.update(doc.ref, { reportsToCode: newReportsTo });
        referralUpdatesCount++;

        // Track affected referrals
        const correctionEntry = result.corrections.find(
          (c) => c.originalStaffId === oldReportsTo
        );
        if (correctionEntry) {
          correctionEntry.affectedReferrals++;
        }
      }
    });

    // Step 6: Commit all changes
    await batch.commit();

    result.success = true;
    result.correctedCount = toCorrect.length;
    result.referralUpdatesCount = referralUpdatesCount;

    return result;
  } catch (err) {
    result.success = false;
    result.errors.push(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}

/**
 * Preview the migration without making changes.
 * Returns what would be corrected.
 */
export async function previewStaffCodeMigration(): Promise<MigrationResult> {
  const db = getAdminDb();
  const result: MigrationResult = {
    success: true,
    totalRecords: 0,
    correctedCount: 0,
    referralUpdatesCount: 0,
    corrections: [],
    errors: [],
  };

  try {
    const staffSnap = await db.collection("staff").get();
    result.totalRecords = staffSnap.size;

    let referralUpdateCount = 0;

    staffSnap.forEach((doc) => {
      const record = doc.data() as StaffRecord;

      if (!hasCorrectSuffix(record.staffId)) {
        const newStaffId = correctStaffCode(record.staffId);

        // Count how many users have this code as their referrer
        let affectedReferrals = 0;
        staffSnap.forEach((otherDoc) => {
          const otherRecord = otherDoc.data() as StaffRecord;
          if (otherRecord.reportsToCode === record.staffId) {
            affectedReferrals++;
          }
        });

        result.corrections.push({
          originalStaffId: record.staffId,
          newStaffId,
          userName: record.fullName,
          affectedReferrals,
        });

        result.correctedCount++;
        referralUpdateCount += affectedReferrals;
      }
    });

    result.referralUpdatesCount = referralUpdateCount;
    return result;
  } catch (err) {
    result.success = false;
    result.errors.push(`Preview failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}
