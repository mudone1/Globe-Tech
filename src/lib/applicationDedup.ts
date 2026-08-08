import { getAdminDb } from "@/lib/firebase-admin";
import { normalizeNigerianPhone } from "@/lib/phone";
import type { ApplicationRecord } from "@/lib/types";

export interface DedupGroup {
  phoneNormalized: string;
  keptApplicationId: string;
  keptReason: string;
  // Set only when the kept record itself is "unassigned" but exactly one
  // real staff code exists among its duplicates — recovers that attribution
  // onto the survivor instead of silently losing it once the duplicate that
  // actually carried it gets archived. Never set when there's a genuine
  // conflict between two different real codes (that's needsReview instead).
  keptReferredByOverride?: string;
  toArchive: Array<{ applicationId: string; applicantName: string; createdAt: string }>;
  needsReview: boolean;
  reviewReason?: string;
  // Present on every member for display purposes (kept + archived), so the
  // preview UI can show the full group, not just what would be archived.
  members: Array<{
    applicationId: string;
    applicantName: string;
    phone: string;
    referredBy: string;
    hasBankDetails: boolean;
    phase2VerificationStatus?: string;
    createdAt: string;
  }>;
}

export interface DedupPreviewResult {
  totalApplications: number;
  totalGroups: number;
  groupsSafeToResolve: number;
  groupsNeedingReview: number;
  groups: DedupGroup[];
}

export interface DedupExecuteResult {
  success: boolean;
  groupsProcessed: number;
  applicationsArchived: number;
  groupsSkippedForReview: number;
  errors: string[];
}

/**
 * Groups all non-test applications by normalized phone number and decides,
 * per group, which record to keep — per the exact priority rules:
 *   1. Exactly one record has a bank account number -> keep it.
 *   2. Multiple records have a bank account number -> keep the one with
 *      phase2VerificationStatus "completed", else the latest
 *      accountDetailsSubmittedAt.
 *   3. None have a bank account number -> keep the latest phase1SubmittedAt
 *      (most recent resubmission attempt).
 * A group is flagged needsReview (and excluded from Execute) if the kept
 * record's referredBy differs from another member's referredBy and neither
 * is "unassigned" — staff attribution conflicts are never auto-resolved.
 */
async function buildDedupGroups(): Promise<{ totalApplications: number; groups: DedupGroup[] }> {
  const db = getAdminDb();
  const snap = await db.collection("applications").get();

  const byPhone = new Map<string, ApplicationRecord[]>();
  let total = 0;

  snap.forEach((doc) => {
    const app = doc.data() as ApplicationRecord;
    if (app.isTest) return;
    total++;

    const normalized = app.phoneNormalized || normalizeNigerianPhone(app.phone || "");
    if (!normalized) return; // can't group what we can't normalize — left untouched

    const list = byPhone.get(normalized) ?? [];
    list.push(app);
    byPhone.set(normalized, list);
  });

  const groups: DedupGroup[] = [];

  for (const [phoneNormalized, members] of byPhone.entries()) {
    if (members.length < 2) continue;

    const withBank = members.filter((m) => Boolean(m.bankAccountNumber));
    let kept: ApplicationRecord;
    let keptReason: string;

    if (withBank.length === 1) {
      kept = withBank[0]!;
      keptReason = "Only record in this group with a submitted FirstBank account number.";
    } else if (withBank.length > 1) {
      const completed = withBank.find((m) => m.phase2VerificationStatus === "completed");
      if (completed) {
        kept = completed;
        keptReason = "FirstBank account number submitted and fully verified (completed).";
      } else {
        kept = withBank.reduce((latest, m) =>
          (m.accountDetailsSubmittedAt || "") > (latest.accountDetailsSubmittedAt || "") ? m : latest
        );
        keptReason = "Most recently submitted FirstBank account number among multiple candidates.";
      }
    } else {
      kept = members.reduce((latest, m) => ((m.phase1SubmittedAt || "") > (latest.phase1SubmittedAt || "") ? m : latest));
      keptReason = "No record in this group has bank details yet — kept the most recent submission attempt.";
    }

    // Distinct real (non-"unassigned") referrer codes anywhere in the group.
    const realReferrers = new Set(members.filter((m) => m.referredBy !== "unassigned").map((m) => m.referredBy));

    let needsReview = false;
    let reviewReason: string | undefined;
    let keptReferredByOverride: string | undefined;
    let effectiveReason = keptReason;

    if (realReferrers.size > 1) {
      // Two or more genuinely different staff codes among the duplicates —
      // never auto-resolve which one is correct.
      needsReview = true;
      reviewReason = `Duplicates have different staff codes (${Array.from(realReferrers).join(", ")}) — resolve manually before this group can be cleaned up.`;
    } else if (realReferrers.size === 1 && kept.referredBy === "unassigned") {
      // Exactly one real code exists, but it happens to sit on a record that
      // priority rules didn't keep — recover it onto the survivor rather
      // than losing it when the duplicate carrying it gets archived.
      keptReferredByOverride = Array.from(realReferrers)[0];
      effectiveReason = `${keptReason} (staff attribution recovered from a duplicate — the kept record itself had none.)`;
    }

    groups.push({
      phoneNormalized,
      keptApplicationId: kept.applicationId,
      keptReason: effectiveReason,
      keptReferredByOverride,
      toArchive: members
        .filter((m) => m.applicationId !== kept.applicationId)
        .map((m) => ({ applicationId: m.applicationId, applicantName: m.applicantName, createdAt: m.createdAt })),
      needsReview,
      reviewReason,
      members: members.map((m) => ({
        applicationId: m.applicationId,
        applicantName: m.applicantName,
        phone: m.phone,
        referredBy: m.referredBy,
        hasBankDetails: Boolean(m.bankAccountNumber),
        phase2VerificationStatus: m.phase2VerificationStatus,
        createdAt: m.createdAt,
      })),
    });
  }

  return { totalApplications: total, groups };
}

export async function previewApplicationDedup(): Promise<DedupPreviewResult> {
  const { totalApplications, groups } = await buildDedupGroups();
  const groupsNeedingReview = groups.filter((g) => g.needsReview).length;

  return {
    totalApplications,
    totalGroups: groups.length,
    groupsSafeToResolve: groups.length - groupsNeedingReview,
    groupsNeedingReview,
    groups: groups.sort((a, b) => b.toArchive.length - a.toArchive.length),
  };
}

/**
 * Archives (copies to applicationDuplicatesArchive, then deletes) every
 * non-kept record in every group that doesn't need manual review. Sequential
 * operations — Firestore batches don't allow delete+create in the same
 * request, a lesson already learned the hard way on the staff-code migration.
 */
export async function executeApplicationDedup(): Promise<DedupExecuteResult> {
  const result: DedupExecuteResult = {
    success: false,
    groupsProcessed: 0,
    applicationsArchived: 0,
    groupsSkippedForReview: 0,
    errors: [],
  };

  try {
    const db = getAdminDb();
    const { groups } = await buildDedupGroups();

    for (const group of groups) {
      if (group.needsReview) {
        result.groupsSkippedForReview++;
        continue;
      }

      try {
        // Backfill phoneNormalized, and recover attribution onto the kept
        // record if flagged, before archiving anything else in this group.
        const keptRef = db.collection("applications").doc(group.keptApplicationId);
        const keptSnap = await keptRef.get();
        if (keptSnap.exists) {
          const keptData = keptSnap.data() as ApplicationRecord;
          const updates: Partial<ApplicationRecord> = {};
          if (!keptData.phoneNormalized) updates.phoneNormalized = group.phoneNormalized;
          if (group.keptReferredByOverride) {
            updates.referredBy = group.keptReferredByOverride;
            updates.grantCode = group.keptReferredByOverride;
          }
          if (Object.keys(updates).length > 0) await keptRef.update(updates);
        }

        for (const dup of group.toArchive) {
          const dupRef = db.collection("applications").doc(dup.applicationId);
          const dupSnap = await dupRef.get();
          if (!dupSnap.exists) continue; // already archived in a previous run

          await db.collection("applicationDuplicatesArchive").doc(dup.applicationId).set({
            ...dupSnap.data(),
            archivedAt: new Date().toISOString(),
            archivedReason: `Duplicate of ${group.keptApplicationId} (${group.keptReason})`,
          });
          await dupRef.delete();
          result.applicationsArchived++;
        }

        result.groupsProcessed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Group ${group.phoneNormalized}: ${msg}`);
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.success = false;
    result.errors.push(`Dedup execution failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }
}
