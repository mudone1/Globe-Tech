export type StaffTier = "Regional Coordinator" | "State Coordinator" | "Marketing Officer";

export interface StaffRecord {
  staffId: string; // e.g. GBT07R/115545925 — doc ID
  fullName: string;
  tier: StaffTier;
  email: string;
  phone: string;
  state: string;
  active: boolean;
  sourceRow: number; // row number back in the onboarding Google Sheet
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

export interface ApplicationRecord {
  applicationId: string; // doc ID, auto
  referredBy: string; // real staffId, or "unassigned"
  applicantName: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: string;
  grantAmountRequested: number;
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
