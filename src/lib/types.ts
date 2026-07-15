export type StaffTier = "Regional Coordinator" | "State Coordinator" | "Marketing Officer";

export interface StaffRecord {
  staffId: string; // e.g. GBT07R/115545925 — doc ID. Read directly from the sheet's "Staff Code" column.
  fullName: string;
  tier: StaffTier;
  email: string;
  phone: string;
  state: string;
  active: boolean;
  sourceRow: number; // row number back in the onboarding Google Sheet
  reportsToCode?: string; // from the sheet's "Reports To Code" column, if present
  reportsToName?: string; // from the sheet's "Reports To Name" column, if present
  authUid?: string; // Firebase Auth UID, set once this staff member self-registers
}

export interface LinkTokenRecord {
  token: string; // doc ID, e.g. "x7k9dQ"
  staffId: string;
  createdAt: string; // ISO timestamp
}

export type ApplicationStatus =
  | "phase1_submitted"
  | "phase2_email_sent"
  | "phase2_marked_complete";

// Full application record — one field per question in the Globe-Tech SME
// Grant application (see Grant Application Questions.docx, Q1–Q47).
export interface ApplicationRecord {
  applicationId: string; // doc ID, auto
  referredBy: string; // real staffId, or "unassigned"

  // Section 1 — Personal Information (Q1–9)
  applicantName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  stateOfResidence: string;
  lga: string;
  linkedin: string;
  businessSocialHandle: string;

  // Section 2 — Entrepreneur Profile (Q10–11)
  currentStatus: string;
  hasPriorBusiness: string; // "Yes" | "No"
  priorBusinessDescription: string;

  // Section 3 — Business Information (Q12–15)
  businessName: string;
  businessDescription: string;
  industry: string;
  supportCategory: string;

  // Section 4 — Business Stage & Operations (Q16–22)
  businessStage: string;
  operatingDuration: string;
  dateEstablished: string;
  registrationStatus: string;
  cacNumber: string;
  operatingLocation: string;
  employeeCount: string;

  // Section 5 — Revenue & Business Performance (Q23–27)
  hasRevenue: string; // "Yes" | "No"
  avgMonthlyRevenue: string;
  revenueLast12Months: string;
  mainCustomers: string;
  customerAcquisitionChannels: string[];

  // Section 6 — Funding Need & Business Needs (Q28–31)
  grantAmountRequested: number;
  fundingUse: string[];
  fundingGrowthExplanation: string;
  biggestChallenge: string;

  // Section 7 — Entrepreneur Vision & Impact (Q32–36)
  whyStartBusiness: string;
  problemSolved: string;
  desiredImpact: string;
  fiveYearVision: string;
  jobsToCreate: string;

  // Section 8 — Grant Application Questions (Q37–41)
  whyApplying: string;
  whySelected: string;
  whatMakesDifferent: string;
  appliedBefore: string; // "Yes" | "No"
  receivedFundingBefore: string; // "Yes" | "No" | ""
  priorFundingDetails: string;

  // Section 9 — Business Academy Commitment (Q42–44)
  willingAcademy: string; // "Yes" | "No"
  willingMentorship: string; // "Yes" | "No"
  improvementAreas: string[];

  // Section 10 — Referral Information (Q45–46)
  howHeard: string;
  entrepreneurNetwork: string;

  // Final declaration (Q47)
  declarationAgreed: boolean;

  status: ApplicationStatus;
  createdAt: string;
  phase1SubmittedAt: string;
  firstBankReferralCode: string;
}

export interface EmailLogRecord {
  applicationId: string;
  type: "phase2_instructions";
  sentAt: string;
  opened: boolean;
  clicked: boolean;
}
