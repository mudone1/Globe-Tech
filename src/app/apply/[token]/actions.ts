"use server";

import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { resolveStaffIdFromToken, isTokenFlaggedTest } from "@/lib/referral";
import { sendGrantCodeEmail } from "@/lib/email";
import { GRANT_CATEGORIES } from "@/lib/grantCategories";
import { maskEmail } from "@/lib/maskEmail";
import type { ApplicationRecord, EmailLogRecord, VisitRecord, GrantCategoryId } from "@/lib/types";

const REF_COOKIE = "gt_ref_token";

/**
 * Called once on page load (client useEffect) to persist the token in a
 * short-lived cookie. This is the "cookie fallback" from the architecture
 * table — it survives a refresh even if the applicant loses the URL.
 * The cookie stores the opaque token only, never the resolved staffId.
 *
 * Also logs a lightweight visit record so the admin analytics dashboard can
 * show a real "link visited → application submitted" conversion rate, not
 * just submission counts. Best-effort — a failed write here never blocks
 * the applicant from continuing.
 */
export async function recordVisit(token: string) {
  const store = await cookies();
  store.set(REF_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days — long enough to cover a slow applicant, short enough to stay "short-lived"
    path: "/",
  });

  try {
    const [staffId, isTest] = await Promise.all([
      resolveStaffIdFromToken(token).then((id) => id ?? "unassigned"),
      isTokenFlaggedTest(token),
    ]);
    const record: VisitRecord = { token, staffId, visitedAt: new Date().toISOString(), ...(isTest ? { isTest: true } : {}) };
    await getAdminDb().collection("visits").add(record);
  } catch (err) {
    console.error("recordVisit: failed to log visit (non-fatal):", err);
  }
}

export interface SubmitApplicationInput {
  token: string;

  grantCategory: GrantCategoryId;
  grantAmount: number;

  // Universal
  applicantName: string;
  phone: string;
  email: string;
  stateOfResidence: string;
  businessName: string;
  grantNeedExplanation: string;

  // Trader categories (1–3) only
  businessType?: string;
  businessLocation?: string;
  monthlyProductCost?: number;

  // Enterprise/LLC categories (4–6) only
  cacNumber?: string;
  businessDescription?: string;

  declarationAgreed: boolean;

  honeypot: string; // must arrive empty — bots fill every field
}

export interface SubmitApplicationResult {
  ok: boolean;
  error?: string;
  grantCode?: string;
}

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<SubmitApplicationResult> {
  // Spam guard: a real applicant never sees or fills this field.
  if (input.honeypot) {
    // Pretend success so bots don't learn the honeypot worked.
    return { ok: true, grantCode: "GT-DEMO" };
  }

  const category = GRANT_CATEGORIES.find((c) => c.id === input.grantCategory);
  if (!category) {
    return { ok: false, error: "Select a grant category to continue." };
  }

  const requiredStrings: Array<[string, string]> = [
    ["Full name", input.applicantName],
    ["Phone number", input.phone],
    ["Email address", input.email],
    ["State of residence", input.stateOfResidence],
    ["Business name", input.businessName],
    ["Why you need this grant", input.grantNeedExplanation],
  ];

  if (category.tier === "trader") {
    requiredStrings.push(["Business type", input.businessType ?? ""], ["Business location", input.businessLocation ?? ""]);
    if (!input.monthlyProductCost || Number(input.monthlyProductCost) <= 0) {
      return { ok: false, error: "Enter your approximate monthly product cost." };
    }
  } else {
    requiredStrings.push(
      ["CAC registration number", input.cacNumber ?? ""],
      ["Business description", input.businessDescription ?? ""]
    );
  }

  for (const [label, value] of requiredStrings) {
    if (!value || !value.trim()) {
      return { ok: false, error: `Please complete: ${label}.` };
    }
  }

  if (!input.declarationAgreed) {
    return { ok: false, error: "Please confirm the final declaration to submit." };
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email);
  if (!emailOk) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const phoneOk = /^[0-9+()\-\s]{7,}$/.test(input.phone);
  if (!phoneOk) {
    return { ok: false, error: "Please enter a valid phone number." };
  }

  // One phone number = one applicant. The same email can apply multiple
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
      error: `An application has already been submitted using this phone number. Please check your email (${maskEmail(existing.email)}) for your previous application and Grant Code.`,
    };
  }

  // Resolve fresh from the token — don't trust anything the client claims
  // about who referred them. Fall back to the cookie if the token itself
  // is missing (e.g. a future multi-step flow that drops the URL segment).
  let resolvedToken = input.token;
  let staffId = await resolveStaffIdFromToken(input.token);
  if (!staffId) {
    const store = await cookies();
    const cookieToken = store.get(REF_COOKIE)?.value;
    staffId = await resolveStaffIdFromToken(cookieToken);
    if (staffId && cookieToken) resolvedToken = cookieToken;
  }
  const isTest = await isTokenFlaggedTest(resolvedToken);

  const grantCode = staffId ?? "unassigned";
  const now = new Date().toISOString();

  const docRef = getAdminDb().collection("applications").doc();
  const record: ApplicationRecord = {
    applicationId: docRef.id,
    referredBy: staffId ?? "unassigned",
    ...(isTest ? { isTest: true } : {}),

    grantCategory: input.grantCategory,
    grantAmount: category.amount,

    applicantName: input.applicantName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    stateOfResidence: input.stateOfResidence,
    businessName: input.businessName.trim(),
    grantNeedExplanation: input.grantNeedExplanation.trim(),

    ...(category.tier === "trader"
      ? {
          businessType: (input.businessType ?? "").trim(),
          businessLocation: (input.businessLocation ?? "").trim(),
          monthlyProductCost: Number(input.monthlyProductCost) || 0,
        }
      : {
          cacNumber: (input.cacNumber ?? "").trim(),
          businessDescription: (input.businessDescription ?? "").trim(),
        }),

    declarationAgreed: input.declarationAgreed,

    status: "phase1_submitted",
    createdAt: now,
    phase1SubmittedAt: now,
    grantCode,
  };

  await docRef.set(record);

  // Send the Grant Code + FirstBank account-opening guide immediately.
  // A failed send never fails the submission itself — the application is
  // already saved — it's just logged to emailLogs so it's visible to admins
  // rather than silently disappearing.
  try {
    await sendGrantCodeEmail({
      to: record.email,
      applicantName: record.applicantName,
      grantCode,
      grantCategoryName: category.name,
      grantAmount: category.amount,
      applicationId: docRef.id,
    });
    await docRef.update({ status: "phase2_email_sent" });
    await getAdminDb().collection("emailLogs").add({
      applicationId: docRef.id,
      type: "phase2_instructions",
      sentAt: new Date().toISOString(),
      opened: false,
      clicked: false,
    } satisfies EmailLogRecord);
  } catch (err) {
    console.error(`Grant Code email failed for application ${docRef.id}:`, err);
    await getAdminDb()
      .collection("emailLogs")
      .add({
        applicationId: docRef.id,
        type: "phase2_instructions",
        sentAt: new Date().toISOString(),
        opened: false,
        clicked: false,
        error: err instanceof Error ? err.message : String(err),
      } satisfies EmailLogRecord);
  }

  return { ok: true, grantCode };
}
