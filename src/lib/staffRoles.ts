import type { StaffTier } from "@/lib/types";

export type SignupRole = "regional" | "state" | "marketing";

export interface RoleConfig {
  role: SignupRole;
  tier: StaffTier;
  codeLetter: "R" | "S" | "M";
  title: string;
  tagline: string;
  responsibilities: string[];
  reportsTo: string; // human-readable, shown on the role explanation page
  referrerTier: StaffTier | null; // tier the referrer code must belong to, or null if no code needed
  referrerLabel: string | null; // label for the referrer code input
  requiresApproval: boolean; // true only for Regional Coordinator
}

export const ROLE_CONFIGS: Record<SignupRole, RoleConfig> = {
  regional: {
    role: "regional",
    tier: "Regional Coordinator",
    codeLetter: "R",
    title: "Regional Coordinator",
    tagline: "Oversees a region, builds out State Coordinators beneath them.",
    responsibilities: [
      "Recruit and onboard State Coordinators across their region",
      "Monitor regional referral performance and grant outcomes",
      "Escalate issues from State Coordinators to Globe-Tech admin",
      "Represent Globe-Tech's SME Grant Program at the regional level",
    ],
    reportsTo: "Globe-Tech Admin",
    referrerTier: null,
    referrerLabel: null,
    requiresApproval: true,
  },
  state: {
    role: "state",
    tier: "State Coordinator",
    codeLetter: "S",
    title: "State Coordinator",
    tagline: "Manages Marketing Officers within one state, under a Regional Coordinator.",
    responsibilities: [
      "Recruit and onboard Marketing Officers within their state",
      "Track state-level referral submissions and Phase 2 completions",
      "Support Marketing Officers with applicant questions",
      "Report state performance up to their Regional Coordinator",
    ],
    reportsTo: "a Regional Coordinator",
    referrerTier: "Regional Coordinator",
    referrerLabel: "Your Regional Coordinator's staff code",
    requiresApproval: false,
  },
  marketing: {
    role: "marketing",
    tier: "Marketing Officer",
    codeLetter: "M",
    title: "Marketing Officer",
    tagline: "Refers SME applicants directly, the front line of the program.",
    responsibilities: [
      "Share your personal referral link with SME owners in your area",
      "Guide applicants through the grant application if they need help",
      "Track your own referral submissions and conversions",
      "Report to your State Coordinator",
    ],
    reportsTo: "a State Coordinator",
    referrerTier: "State Coordinator",
    referrerLabel: "Your State Coordinator's staff code",
    requiresApproval: false,
  },
};

export const ROLE_ORDER: SignupRole[] = ["regional", "state", "marketing"];
