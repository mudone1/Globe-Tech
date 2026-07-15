"use server";

import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { resolveStaffIdFromToken, generateFirstBankReferralCode } from "@/lib/referral";
import type { ApplicationRecord } from "@/lib/types";

const REF_COOKIE = "gt_ref_token";

/**
 * Called once on page load (client useEffect) to persist the token in a
 * short-lived cookie. This is the "cookie fallback" from the architecture
 * table — it survives a refresh even if the applicant loses the URL.
 * The cookie stores the opaque token only, never the resolved staffId.
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
}

// Mirrors every question in Grant Application Questions.docx (Q1–Q47).
export interface SubmitApplicationInput {
  token: string;

  // Section 1
  applicantName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  stateOfResidence: string;
  lga: string;
  linkedin: string;
  businessSocialHandle: string;

  // Section 2
  currentStatus: string;
  hasPriorBusiness: string;
  priorBusinessDescription: string;

  // Section 3
  businessName: string;
  businessDescription: string;
  industry: string;
  supportCategory: string;

  // Section 4
  businessStage: string;
  operatingDuration: string;
  dateEstablished: string;
  registrationStatus: string;
  cacNumber: string;
  operatingLocation: string;
  employeeCount: string;

  // Section 5
  hasRevenue: string;
  avgMonthlyRevenue: string;
  revenueLast12Months: string;
  mainCustomers: string;
  customerAcquisitionChannels: string[];

  // Section 6
  grantAmountRequested: number;
  fundingUse: string[];
  fundingGrowthExplanation: string;
  biggestChallenge: string;

  // Section 7
  whyStartBusiness: string;
  problemSolved: string;
  desiredImpact: string;
  fiveYearVision: string;
  jobsToCreate: string;

  // Section 8
  whyApplying: string;
  whySelected: string;
  whatMakesDifferent: string;
  appliedBefore: string;
  receivedFundingBefore: string;
  priorFundingDetails: string;

  // Section 9
  willingAcademy: string;
  willingMentorship: string;
  improvementAreas: string[];

  // Section 10
  howHeard: string;
  entrepreneurNetwork: string;

  // Final declaration
  declarationAgreed: boolean;

  honeypot: string; // must arrive empty — bots fill every field
}

export interface SubmitApplicationResult {
  ok: boolean;
  error?: string;
  firstBankReferralCode?: string;
}

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<SubmitApplicationResult> {
  // Spam guard: a real applicant never sees or fills this field.
  if (input.honeypot) {
    // Pretend success so bots don't learn the honeypot worked.
    return { ok: true, firstBankReferralCode: generateFirstBankReferralCode() };
  }

  const requiredStrings: Array<[string, string]> = [
    ["Full name", input.applicantName],
    ["Gender", input.gender],
    ["Date of birth", input.dateOfBirth],
    ["Phone number", input.phone],
    ["Email address", input.email],
    ["State of residence", input.stateOfResidence],
    ["Local Government Area", input.lga],
    ["Current status", input.currentStatus],
    ["Previous business experience answer", input.hasPriorBusiness],
    ["Business name", input.businessName],
    ["Business description", input.businessDescription],
    ["Industry", input.industry],
    ["Support category", input.supportCategory],
    ["Business stage", input.businessStage],
    ["Operating duration", input.operatingDuration],
    ["Date established", input.dateEstablished],
    ["Registration status", input.registrationStatus],
    ["Operating location", input.operatingLocation],
    ["Employee count", input.employeeCount],
    ["Revenue status", input.hasRevenue],
    ["Revenue in the last 12 months", input.revenueLast12Months],
    ["Main customers", input.mainCustomers],
    ["Funding growth explanation", input.fundingGrowthExplanation],
    ["Biggest challenge", input.biggestChallenge],
    ["Why you started this business", input.whyStartBusiness],
    ["Problem your business solves", input.problemSolved],
    ["Desired impact", input.desiredImpact],
    ["Five-year vision", input.fiveYearVision],
    ["Jobs to create", input.jobsToCreate],
    ["Why you're applying", input.whyApplying],
    ["Why you should be selected", input.whySelected],
    ["What makes your business different", input.whatMakesDifferent],
    ["Prior grant application answer", input.appliedBefore],
    ["Business Academy commitment answer", input.willingAcademy],
    ["Mentorship commitment answer", input.willingMentorship],
    ["How you heard about the program", input.howHeard],
  ];

  for (const [label, value] of requiredStrings) {
    if (!value || !value.trim()) {
      return { ok: false, error: `Please complete: ${label}.` };
    }
  }

  if (!input.grantAmountRequested || Number(input.grantAmountRequested) <= 0) {
    return { ok: false, error: "Please enter the funding amount you're requesting." };
  }
  if (!input.fundingUse || input.fundingUse.length === 0) {
    return { ok: false, error: "Select at least one intended use for the grant funding." };
  }
  if (!input.customerAcquisitionChannels || input.customerAcquisitionChannels.length === 0) {
    return { ok: false, error: "Select how customers currently find your business." };
  }
  if (!input.improvementAreas || input.improvementAreas.length === 0) {
    return { ok: false, error: "Select at least one area of business development to improve." };
  }
  if (input.hasRevenue === "Yes" && !input.avgMonthlyRevenue) {
    return { ok: false, error: "Select your average monthly revenue." };
  }
  if (input.appliedBefore === "Yes" && !input.receivedFundingBefore) {
    return { ok: false, error: "Let us know whether you received funding previously." };
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

  // Resolve fresh from the token — don't trust anything the client claims
  // about who referred them. Fall back to the cookie if the token itself
  // is missing (e.g. a future multi-step flow that drops the URL segment).
  let staffId = await resolveStaffIdFromToken(input.token);
  if (!staffId) {
    const store = await cookies();
    const cookieToken = store.get(REF_COOKIE)?.value;
    staffId = await resolveStaffIdFromToken(cookieToken);
  }

  const firstBankReferralCode = generateFirstBankReferralCode();
  const now = new Date().toISOString();

  const docRef = getAdminDb().collection("applications").doc();
  const record: ApplicationRecord = {
    applicationId: docRef.id,
    referredBy: staffId ?? "unassigned",

    applicantName: input.applicantName.trim(),
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    stateOfResidence: input.stateOfResidence,
    lga: input.lga.trim(),
    linkedin: input.linkedin.trim(),
    businessSocialHandle: input.businessSocialHandle.trim(),

    currentStatus: input.currentStatus,
    hasPriorBusiness: input.hasPriorBusiness,
    priorBusinessDescription: input.priorBusinessDescription.trim(),

    businessName: input.businessName.trim(),
    businessDescription: input.businessDescription.trim(),
    industry: input.industry,
    supportCategory: input.supportCategory,

    businessStage: input.businessStage,
    operatingDuration: input.operatingDuration,
    dateEstablished: input.dateEstablished,
    registrationStatus: input.registrationStatus,
    cacNumber: input.cacNumber.trim(),
    operatingLocation: input.operatingLocation,
    employeeCount: input.employeeCount,

    hasRevenue: input.hasRevenue,
    avgMonthlyRevenue: input.avgMonthlyRevenue,
    revenueLast12Months: input.revenueLast12Months.trim(),
    mainCustomers: input.mainCustomers.trim(),
    customerAcquisitionChannels: input.customerAcquisitionChannels,

    grantAmountRequested: Number(input.grantAmountRequested) || 0,
    fundingUse: input.fundingUse,
    fundingGrowthExplanation: input.fundingGrowthExplanation.trim(),
    biggestChallenge: input.biggestChallenge.trim(),

    whyStartBusiness: input.whyStartBusiness.trim(),
    problemSolved: input.problemSolved.trim(),
    desiredImpact: input.desiredImpact.trim(),
    fiveYearVision: input.fiveYearVision.trim(),
    jobsToCreate: input.jobsToCreate,

    whyApplying: input.whyApplying.trim(),
    whySelected: input.whySelected.trim(),
    whatMakesDifferent: input.whatMakesDifferent.trim(),
    appliedBefore: input.appliedBefore,
    receivedFundingBefore: input.receivedFundingBefore,
    priorFundingDetails: input.priorFundingDetails.trim(),

    willingAcademy: input.willingAcademy,
    willingMentorship: input.willingMentorship,
    improvementAreas: input.improvementAreas,

    howHeard: input.howHeard,
    entrepreneurNetwork: input.entrepreneurNetwork.trim(),

    declarationAgreed: input.declarationAgreed,

    status: "phase1_submitted",
    createdAt: now,
    phase1SubmittedAt: now,
    firstBankReferralCode,
  };

  await docRef.set(record);

  // Phase 3 (email + Sheets backup) is triggered by a Firestore onCreate
  // Cloud Function — see functions/src/onApplicationCreated.ts — once you've
  // supplied the Resend/SendGrid key and backup Sheet. Nothing further to
  // do here.

  return { ok: true, firstBankReferralCode };
}
