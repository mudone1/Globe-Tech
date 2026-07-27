import { getAdminDb } from "@/lib/firebase-admin";
import { staffDocId } from "@/lib/staffId";
import { sendBulkStaffCodeNotifications } from "@/lib/staffCodeNotification";
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
  emailsSent?: number;
  emailsFailed?: number;
  emailErrors?: Array<{ email: string; error: string }>;
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
  console.log("[Migration] Starting staff code migration...");

  const result: MigrationResult = {
    success: false,
    totalRecords: 0,
    correctedCount: 0,
    referralUpdatesCount: 0,
    corrections: [],
    errors: [],
  };

  try {
    console.log("[Migration] Initializing Firebase Admin database...");
    const db = getAdminDb();
    console.log("[Migration] Firebase Admin initialized");

    // Step 1: Read all staff records
    console.log("[Migration] Reading all staff records from Firestore...");
    const staffSnap = await db.collection("staff").get();
    result.totalRecords = staffSnap.size;
    console.log(`[Migration] Found ${result.totalRecords} total staff records`);

    if (result.totalRecords === 0) {
      console.log("[Migration] No staff records found");
      result.success = true;
      result.errors.push("No staff records found in database");
      return result;
    }

    // Step 2: Identify records that need correction
    console.log("[Migration] Identifying records with incorrect suffixes...");
    const toCorrect: Array<{ doc: FirebaseFirestore.DocumentSnapshot; record: StaffRecord }> = [];

    staffSnap.forEach((doc) => {
      const record = doc.data() as StaffRecord;
      if (!hasCorrectSuffix(record.staffId)) {
        console.log(`[Migration] Found incorrect suffix: ${record.staffId}`);
        toCorrect.push({ doc, record });
      }
    });

    console.log(`[Migration] ${toCorrect.length} records need correction`);

    if (toCorrect.length === 0) {
      console.log("[Migration] No records need correction - all suffixes are already correct");
      result.success = true;
      result.correctedCount = 0;
      return result;
    }

    // Step 3: Create mapping of old → new staff codes for referral updates
    console.log("[Migration] Creating code mapping for referral updates...");
    const codeMapping = new Map<string, string>();
    toCorrect.forEach(({ record }) => {
      const newCode = correctStaffCode(record.staffId);
      console.log(`[Migration] Mapping: ${record.staffId} → ${newCode}`);
      codeMapping.set(record.staffId, newCode);
    });

    // Step 4: Apply corrections
    console.log("[Migration] Preparing batch operations...");
    const batch = db.batch();
    let referralUpdatesCount = 0;

    // Track which staffIds are being corrected (to avoid updating them in the same batch)
    const correctedStaffIds = new Set<string>();

    for (const { doc, record } of toCorrect) {
      const oldStaffId = record.staffId;
      const newStaffId = correctStaffCode(oldStaffId);
      const now = new Date().toISOString();

      correctedStaffIds.add(oldStaffId);

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
    // Skip updating documents that are themselves being corrected (deleted/recreated in this batch)
    staffSnap.forEach((doc) => {
      const record = doc.data() as StaffRecord;

      // Skip if this staff member is being corrected (already handled above)
      if (correctedStaffIds.has(record.staffId)) {
        return;
      }

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
    console.log(`[Migration] Committing ${toCorrect.length} corrections and ${referralUpdatesCount} referral updates...`);
    await batch.commit();
    console.log("[Migration] Batch commit completed successfully");

    // Step 7: Send notification emails to corrected staff
    console.log("[Migration] Preparing email notifications...");
    const emailNotifications = toCorrect.map(({ record }) => ({
      email: record.email,
      fullName: record.fullName,
      oldStaffId: record.originalStaffId || record.staffId,
      newStaffId: correctStaffCode(record.staffId),
    }));

    console.log(`[Migration] Sending ${emailNotifications.length} notification emails...`);
    const emailResult = await sendBulkStaffCodeNotifications(emailNotifications);

    result.success = true;
    result.correctedCount = toCorrect.length;
    result.referralUpdatesCount = referralUpdatesCount;
    result.emailsSent = emailResult.successful;
    result.emailsFailed = emailResult.failed;
    if (emailResult.errors.length > 0) {
      result.emailErrors = emailResult.errors;
      result.errors.push(`Email sending: ${emailResult.failed} failed`);
    }

    console.log("[Migration] Migration completed successfully");
    console.log(`[Migration] Results: ${result.correctedCount} corrected, ${result.referralUpdatesCount} referral updates, ${emailResult.successful} emails sent`);

    return result;
  } catch (err) {
    result.success = false;
    const errorMessage = err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    result.errors.push(`Migration failed: ${errorMessage}`);
    console.error("Migration error:", err);
    return result;
  }
}

/**
 * Preview the migration without making changes.
 * Returns what would be corrected.
 */
export async function previewStaffCodeMigration(): Promise<MigrationResult> {
  console.log("[Preview] Starting migration preview...");

  const result: MigrationResult = {
    success: true,
    totalRecords: 0,
    correctedCount: 0,
    referralUpdatesCount: 0,
    corrections: [],
    errors: [],
  };

  try {
    console.log("[Preview] Initializing Firebase Admin...");
    const db = getAdminDb();
    console.log("[Preview] Reading all staff records...");
    const staffSnap = await db.collection("staff").get();
    result.totalRecords = staffSnap.size;
    console.log(`[Preview] Found ${result.totalRecords} records`);

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
