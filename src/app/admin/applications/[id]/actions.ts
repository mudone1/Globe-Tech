"use server";

import { getAdminDb } from "@/lib/firebase-admin";
import type { ApplicationRecord, StaffRecord } from "@/lib/types";

export type SetReferrerResult = { ok: true; staffName: string } | { ok: false; error: string };

/**
 * Manually corrects an application's referrer/attribution — needed for
 * applications that were written with referredBy "unassigned" because the
 * token→staffId lookup failed at submission time (e.g. during a database
 * outage) rather than because the applicant genuinely had no referrer.
 * grantCode mirrors referredBy throughout this app, so both are updated
 * together to keep them consistent. Uses the Admin SDK because referredBy/
 * grantCode aren't in firestore.rules' client-writable field allowlist for
 * applications — that's intentional (this shouldn't be casually editable
 * from the client), so the correction goes through this admin-gated action
 * instead of loosening the rules.
 */
export async function setApplicationReferrer(applicationId: string, staffId: string): Promise<SetReferrerResult> {
  const trimmed = staffId.trim();
  if (!trimmed) return { ok: false, error: "Enter a staff code." };

  const db = getAdminDb();

  const staffSnap = await db.collection("staff").where("staffId", "==", trimmed).limit(1).get();
  if (staffSnap.empty) {
    return { ok: false, error: `No staff member found with code "${trimmed}".` };
  }
  const staff = staffSnap.docs[0]!.data() as StaffRecord;

  const appRef = db.collection("applications").doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    return { ok: false, error: "Application not found." };
  }

  await appRef.update({
    referredBy: trimmed,
    grantCode: trimmed,
    referralResolutionFailed: false,
  } satisfies Partial<ApplicationRecord>);

  return { ok: true, staffName: staff.fullName };
}
