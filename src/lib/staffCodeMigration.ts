import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
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
 * Uses a simpler approach: update reportsToCode fields first, then recreate records with new IDs.
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
    const codeMapping = new Map<string, string>();

    staffSnap.forEach((doc) => {
      const record = doc.data() as StaffRecord;
      if (!hasCorrectSuffix(record.staffId)) {
        console.log(`[Migration] Found incorrect suffix: ${record.staffId}`);
        toCorrect.push({ doc, record });
        const newCode = correctStaffCode(record.staffId);
        codeMapping.set(record.staffId, newCode);
      }
    });

    console.log(`[Migration] ${toCorrect.length} records need correction`);

    if (toCorrect.length === 0) {
      console.log("[Migration] No records need correction");
      result.success = true;
      result.correctedCount = 0;
      return result;
    }

    // Step 3: First pass - Update all reportsToCode fields to point to new codes
    console.log("[Migration] Step 1: Updating referral references to new staff codes...");
    let referralUpdatesCount = 0;

    for (const doc of staffSnap.docs) {
      const record = doc.data() as StaffRecord;

      if (record.reportsToCode && codeMapping.has(record.reportsToCode)) {
        const newReportsTo = codeMapping.get(record.reportsToCode)!;

        try {
          console.log(
            `[Migration] Updating ${record.staffId} referral: ${record.reportsToCode} → ${newReportsTo}`
          );
          await db.collection("staff").doc(doc.id).update({ reportsToCode: newReportsTo });
          referralUpdatesCount++;

          const correctionEntry = result.corrections.find(
            (c) => c.originalStaffId === record.reportsToCode
          );
          if (correctionEntry) {
            correctionEntry.affectedReferrals++;
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Migration] Error updating referral for ${record.staffId}: ${errMsg}`);
          result.errors.push(`Referral update failed: ${errMsg}`);
        }
      }
    }

    console.log(`[Migration] Referral updates completed: ${referralUpdatesCount}`);

    // Step 4: Second pass - Now safely delete old and create new documents
    console.log("[Migration] Step 2: Recreating staff records with corrected codes...");

    for (const { doc, record } of toCorrect) {
      const oldStaffId = record.staffId;
      const newStaffId = correctStaffCode(oldStaffId);
      const now = new Date().toISOString();

      const correctedRecord: StaffRecord = {
        ...record,
        staffId: newStaffId,
        staffCodeCorrected: true,
        staffCodeCorrectedAt: now,
        originalStaffId: oldStaffId,
      };

      try {
        console.log(`[Migration] Recreating ${oldStaffId} → ${newStaffId}`);

        // Delete old, create new
        await db.collection("staff").doc(staffDocId(oldStaffId)).delete();
        await db.collection("staff").doc(staffDocId(newStaffId)).set(correctedRecord);

        // Keep the Firebase Auth ID token's staffId claim in sync — login
        // trusts this claim, not the Firestore doc, so without this update
        // staff can never log in again after their code changes.
        if (record.authUid) {
          await getAdminAuth().setCustomUserClaims(record.authUid, {
            staffId: newStaffId,
            tier: record.tier,
          });
        }

        // Repoint any existing referral link token to the new staffId so
        // links already shared before the migration keep working.
        const tokenSnap = await db.collection("linkTokens").where("staffId", "==", oldStaffId).get();
        for (const tokenDoc of tokenSnap.docs) {
          await tokenDoc.ref.update({ staffId: newStaffId });
        }

        result.corrections.push({
          originalStaffId: oldStaffId,
          newStaffId,
          userName: record.fullName,
          affectedReferrals: 0,
        });

        result.correctedCount++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Migration] Error recreating ${oldStaffId}: ${errMsg}`);
        result.errors.push(`Failed to recreate ${oldStaffId}: ${errMsg}`);
      }
    }

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

export interface ResendNotificationsResult {
  success: boolean;
  totalCorrectedStaff: number;
  emailsSent: number;
  emailsFailed: number;
  emailErrors: Array<{ email: string; error: string }>;
  errors: string[];
}

/**
 * Re-sends the staff code correction email to everyone already marked
 * staffCodeCorrected in Firestore, without touching any staff codes.
 * Use this when the migration itself succeeded but email delivery failed
 * (e.g. a missing/misconfigured email provider).
 */
export async function resendStaffCodeCorrectionNotifications(): Promise<ResendNotificationsResult> {
  const result: ResendNotificationsResult = {
    success: false,
    totalCorrectedStaff: 0,
    emailsSent: 0,
    emailsFailed: 0,
    emailErrors: [],
    errors: [],
  };

  try {
    const db = getAdminDb();
    const correctedSnap = await db.collection("staff").where("staffCodeCorrected", "==", true).get();
    result.totalCorrectedStaff = correctedSnap.size;

    if (correctedSnap.size === 0) {
      result.success = true;
      result.errors.push("No corrected staff records found");
      return result;
    }

    const notifications = correctedSnap.docs.map((doc) => {
      const record = doc.data() as StaffRecord;
      return {
        email: record.email,
        fullName: record.fullName,
        oldStaffId: record.originalStaffId || record.staffId,
        newStaffId: record.staffId,
      };
    });

    const emailResult = await sendBulkStaffCodeNotifications(notifications);

    result.success = true;
    result.emailsSent = emailResult.successful;
    result.emailsFailed = emailResult.failed;
    result.emailErrors = emailResult.errors;

    return result;
  } catch (err) {
    result.success = false;
    result.errors.push(`Resend failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}

export interface RepairReferralLinksResult {
  success: boolean;
  totalCorrectedStaff: number;
  tokensRepaired: number;
  tokensAlreadyOk: number;
  tokensMissing: number;
  errors: string[];
}

/**
 * Repoints referral link tokens for staff whose code was already corrected
 * by an earlier migration run (i.e. staffCodeCorrected == true) but whose
 * linkTokens doc still has the old, now-deleted staffId. Without this, both
 * the admin dashboard's referral link and any link already shared with an
 * applicant point at a staffId that no longer exists.
 */
export async function repairReferralLinksForCorrectedStaff(): Promise<RepairReferralLinksResult> {
  const result: RepairReferralLinksResult = {
    success: false,
    totalCorrectedStaff: 0,
    tokensRepaired: 0,
    tokensAlreadyOk: 0,
    tokensMissing: 0,
    errors: [],
  };

  try {
    const db = getAdminDb();
    const correctedSnap = await db.collection("staff").where("staffCodeCorrected", "==", true).get();
    result.totalCorrectedStaff = correctedSnap.size;

    for (const doc of correctedSnap.docs) {
      const record = doc.data() as StaffRecord;
      const oldStaffId = record.originalStaffId;
      if (!oldStaffId) continue;

      try {
        // Already pointing at the new staffId — nothing to do.
        const okSnap = await db.collection("linkTokens").where("staffId", "==", record.staffId).limit(1).get();
        if (!okSnap.empty) {
          result.tokensAlreadyOk++;
          continue;
        }

        const staleSnap = await db.collection("linkTokens").where("staffId", "==", oldStaffId).get();
        if (staleSnap.empty) {
          result.tokensMissing++;
          continue;
        }

        for (const tokenDoc of staleSnap.docs) {
          await tokenDoc.ref.update({ staffId: record.staffId });
        }
        result.tokensRepaired++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to repair token for ${record.staffId}: ${errMsg}`);
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.success = false;
    result.errors.push(`Repair failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}

export interface RepairAuthClaimsResult {
  success: boolean;
  totalCorrectedStaff: number;
  repaired: number;
  skipped: number;
  errors: string[];
}

/**
 * Re-syncs the Firebase Auth staffId claim for everyone already marked
 * staffCodeCorrected == true, whose claim may still point at their old,
 * now-deleted staffId from a migration run that predates this fix.
 * Run this once to unblock anyone currently locked out of login.
 */
export async function repairAuthClaimsForCorrectedStaff(): Promise<RepairAuthClaimsResult> {
  const result: RepairAuthClaimsResult = {
    success: false,
    totalCorrectedStaff: 0,
    repaired: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    const snap = await db.collection("staff").where("staffCodeCorrected", "==", true).get();
    result.totalCorrectedStaff = snap.size;

    for (const doc of snap.docs) {
      const record = doc.data() as StaffRecord;
      if (!record.authUid) {
        result.skipped++;
        continue;
      }
      try {
        await auth.setCustomUserClaims(record.authUid, { staffId: record.staffId, tier: record.tier });
        result.repaired++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to repair claim for ${record.staffId}: ${errMsg}`);
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.success = false;
    result.errors.push(`Repair failed: ${err instanceof Error ? err.message : String(err)}`);
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
