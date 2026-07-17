export type StaffTier = "Regional Coordinator" | "State Coordinator" | "Marketing Officer";

export interface StaffRecord {
  staffId: string; // e.g. GBT07R/115545925 — doc ID. Read directly from the sheet's "Staff Code" column.
  fullName: string;
  tier: StaffTier;
  email: string;
  phone: string;
  state: string;
  active: boolean;
  sourceRow: number; // row number back in the onboarding Google Sheet (0 for self-registered staff)
  reportsToCode?: string; // from the sheet's "Reports To Code" column, if present
  reportsToName?: string; // from the sheet's "Reports To Name" column, if present
  authUid?: string; // Firebase Auth UID, set once this staff member self-registers
  registrationSource?: "sheet" | "self"; // "self" = registered directly on the website, not synced from the sheet
  pendingApproval?: boolean; // true only for self-registered Regional Coordinators awaiting admin approval

  // Onboarding-form fields, collected during self-registration (mirrors the
  // Globe-Tech onboarding Google Forms — see the chat signup flow).
  middleName?: string;
  homeAddress?: string;
  socialMediaPlatform?: string; // Facebook | Instagram | X | LinkedIn
  socialMediaUsername?: string;
  idCardUrl?: string; // Google Drive "view" link for the uploaded NIN/Voter's card
  idCardFileName?: string;
  mouAccepted?: boolean; // all 8 MOU statements acknowledged
  declarationAccepted?: boolean;
  stateToCoordinate?: string; // State Coordinator only — the state they'll operate in
  roleSpecialization?: string; // Regional Coordinator only — "Globe-Tech Regional Marketing Lead" | "Data analysis"
  stateOfInfluence?: string; // Regional Coordinator only
}

// One row per self-registration awaiting the "set password" step. Short-lived —
// deleted once used, so a leaked/guessed URL can't be replayed.
export interface StaffSetupTokenRecord {
  token: string; // doc ID
  staffId: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
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

export type GrantCategoryId = "emerging" | "development" | "expansion" | "growth" | "scaleup" | "impact";

// Full application record — condensed to 10 questions max, tailored to the
// grant category the applicant selects before the chat begins.
export interface ApplicationRecord {
  applicationId: string; // doc ID, auto
  referredBy: string; // real staffId, or "unassigned"

  grantCategory: GrantCategoryId;
  grantAmount: number; // fixed per category — see src/lib/grantCategories.ts

  // Universal (asked regardless of category)
  applicantName: string;
  phone: string;
  email: string;
  stateOfResidence: string;
  businessName: string;
  grantNeedExplanation: string; // why they need it / how it'll help their business

  // Categories 1–3 only (street / marketplace / shop traders)
  businessType?: string;
  businessLocation?: string;
  monthlyProductCost?: number;

  // Categories 4–6 only (registered Business Name or LLC)
  cacNumber?: string;
  cacDocumentUrl?: string; // Google Drive "view" link
  cacDocumentFileName?: string;
  businessDescription?: string;

  declarationAgreed: boolean;

  status: ApplicationStatus;
  createdAt: string;
  phase1SubmittedAt: string;
  grantCode: string; // the referring staff member's staffId — what the applicant enters
                      // as "Additional Information" on FirstBank's account-opening form
}

export interface EmailLogRecord {
  applicationId: string;
  type: "phase2_instructions";
  sentAt: string;
  opened: boolean;
  clicked: boolean;
  error?: string; // set when the send failed — the application itself still saved fine
}

// One row per /apply/[token] page load — powers the referral funnel
// (link visits vs. actual submissions) on the analytics dashboard.
export interface VisitRecord {
  token: string;
  staffId: string; // resolved staffId, or "unassigned" if the token didn't resolve
  visitedAt: string; // ISO timestamp
}

// Single doc (payoutSettings/rate) holding the ₦ commission paid per staff
// member for each of their referrals that reaches phase2_marked_complete.
export interface PayoutSettingsRecord {
  perCompletionAmount: number;
  updatedAt: string;
  updatedBy?: string; // admin's Firebase Auth UID
}

// One row per payment actually made to a staff member — an admin logs these
// on /admin/payouts as they pay out, so "amount paid" updates over time
// rather than being a single paid/unpaid flag.
export interface PayoutRecord {
  id: string; // doc ID
  staffId: string;
  amount: number;
  note?: string;
  paidAt: string; // ISO timestamp
  recordedBy?: string; // admin's Firebase Auth UID
}
