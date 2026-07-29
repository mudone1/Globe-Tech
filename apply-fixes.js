const fs = require("fs");
const path = require("path");

const ROOT = "src"; // change to "globaltech-grant-platform/src" if that's the deployed tree

function patch(filepath, oldStr, newStr, label) {
  const p = path.join(ROOT, filepath);
  let text = fs.readFileSync(p, "utf8");
  if (!text.includes(oldStr)) {
    console.log(`❌ SKIPPED (${label}): pattern not found in ${p}`);
    return false;
  }
  text = text.replace(oldStr, newStr);
  fs.writeFileSync(p, text, "utf8");
  console.log(`✅ Patched: ${label} in ${p}`);
  return true;
}

// ---------- 1. Remove phone duplicate check ----------
patch(
  "app/apply/[token]/actions.ts",
  `  // One phone number = one applicant. The same email can apply multiple
  // times (e.g. for different businesses), but a repeat phone number means
  // this is very likely the same person re-applying — point them back to
  // their existing application instead of creating a duplicate.
  const normalizedPhone = input.phone.trim();
  const existingByPhone = await getAdminDb()
    .collection("applications")
    .where("phone", "==", normalizedPhone)
    .limit(1)
    .get();
  if (!existingByPhone.empty) {
    const existing = existingByPhone.docs[0]!.data() as ApplicationRecord;
    return {
      ok: false,
      error: \`An application has already been submitted using this phone number. Please check your email (\${maskEmail(existing.email)}) for your previous application and Grant Code.\`,
    };
  }

`,
  "",
  "remove phone duplicate check"
);
patch(
  "app/apply/[token]/actions.ts",
  `import { maskEmail } from "@/lib/maskEmail";\n`,
  "",
  "remove unused maskEmail import"
);

// ---------- 2. FirstBank link in confirmation email ----------
patch(
  "lib/email.ts",
  `  const { applicantName, grantCode, appUrl, grantCategoryName, grantAmount, applicationId } = opts;\n`,
  `  const { applicantName, grantCode, appUrl, grantCategoryName, grantAmount, applicationId } = opts;\n  const FIRSTBANK_ACCOUNT_URL = "https://openaccounts2.firstbanknigeria.com/corporate/";\n`,
  "add FIRSTBANK_ACCOUNT_URL constant"
);
patch(
  "lib/email.ts",
  `                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#4B5B52;">
                  You'll enter this in the <strong>Additional Information</strong> box at Step 6 below — it's what
                  links your new account to your grant application.
                </p>
              </td>
            </tr>`,
  `                <p style="margin:8px 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#4B5B52;">
                  You'll enter this in the <strong>Additional Information</strong> box at Step 6 below — it's what
                  links your new account to your grant application.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr><td align="center">
                    <a href="\${FIRSTBANK_ACCOUNT_URL}" style="display:inline-block;background:#C8952A;color:#1A1204;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;padding:13px 24px;border-radius:8px;text-decoration:none;">
                      Open my FirstBank Account →
                    </a>
                  </td></tr>
                </table>
              </td>
            </tr>`,
  "add FirstBank CTA button to email"
);

// ---------- 3. FirstBank button on success page ----------
patch(
  "components/ApplicationForm.tsx",
  `              <div className={styles.rowActions} style={{ maxWidth: 320, margin: "20px auto 0" }}>
                <button className={\`\${styles.btn} \${styles.btnGhost}\`} style={{ flex: 1 }} onClick={copyCode}>
                  {copied ? "Copied ✓" : "Copy code"}
                </button>
              </div>`,
  `              <div className={styles.rowActions} style={{ maxWidth: 320, margin: "20px auto 0" }}>
                <button className={\`\${styles.btn} \${styles.btnGhost}\`} style={{ flex: 1 }} onClick={copyCode}>
                  {copied ? "Copied ✓" : "Copy code"}
                </button>
              </div>
              
                href="https://openaccounts2.firstbanknigeria.com/corporate/"
                target="_blank"
                rel="noopener noreferrer"
                className={\`\${styles.btn} \${styles.btnPrimary}\`}
                style={{ display: "block", textAlign: "center", maxWidth: 320, margin: "12px auto 0", textDecoration: "none" }}
              >
                Open FirstBank Account →
              </a>`,
  "add FirstBank button to success screen"
);

// ---------- 4. Sync Auth claims on staff code migration ----------
patch(
  "lib/staffCodeMigration.ts",
  `import { getAdminDb } from "@/lib/firebase-admin";`,
  `import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";`,
  "import getAdminAuth"
);
patch(
  "lib/staffCodeMigration.ts",
  `        // Delete old, create new
        await db.collection("staff").doc(staffDocId(oldStaffId)).delete();
        await db.collection("staff").doc(staffDocId(newStaffId)).set(correctedRecord);

        // Repoint any existing referral link token to the new staffId so`,
  `        // Delete old, create new
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

        // Repoint any existing referral link token to the new staffId so`,
  "sync Auth claim during migration"
);
patch(
  "lib/staffCodeMigration.ts",
  `/**
 * Preview the migration without making changes.
 * Returns what would be corrected.
 */`,
  `export interface RepairAuthClaimsResult {
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
        result.errors.push(\`Failed to repair claim for \${record.staffId}: \${errMsg}\`);
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.success = false;
    result.errors.push(\`Repair failed: \${err instanceof Error ? err.message : String(err)}\`);
    return result;
  }
}

/**
 * Preview the migration without making changes.
 * Returns what would be corrected.
 */`,
  "add repairAuthClaimsForCorrectedStaff function"
);
patch(
  "app/admin/staff-code-migration/actions.ts",
  `import {
  migrateStaffCodes,
  previewStaffCodeMigration,
  resendStaffCodeCorrectionNotifications,
  repairReferralLinksForCorrectedStaff,
  type MigrationResult,
  type ResendNotificationsResult,
  type RepairReferralLinksResult,
} from "@/lib/staffCodeMigration";`,
  `import {
  migrateStaffCodes,
  previewStaffCodeMigration,
  resendStaffCodeCorrectionNotifications,
  repairReferralLinksForCorrectedStaff,
  repairAuthClaimsForCorrectedStaff,
  type MigrationResult,
  type ResendNotificationsResult,
  type RepairReferralLinksResult,
  type RepairAuthClaimsResult,
} from "@/lib/staffCodeMigration";`,
  "import repairAuthClaimsForCorrectedStaff in actions.ts"
);
patch(
  "app/admin/staff-code-migration/actions.ts",
  `export async function repairReferralLinks(): Promise<RepairReferralLinksResult> {
  return repairReferralLinksForCorrectedStaff();
}`,
  `export async function repairReferralLinks(): Promise<RepairReferralLinksResult> {
  return repairReferralLinksForCorrectedStaff();
}

export async function repairAuthClaims(): Promise<RepairAuthClaimsResult> {
  return repairAuthClaimsForCorrectedStaff();
}`,
  "expose repairAuthClaims server action"
);

console.log("\nDone. Review the ✅/❌ lines above, then git diff to confirm before committing.");
