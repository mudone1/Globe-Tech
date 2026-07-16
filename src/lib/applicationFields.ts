import type { ApplicationRecord } from "@/lib/types";

export type FieldDisplayType = "text" | "list" | "currency" | "boolean" | "date";

export interface FieldMeta {
  key: keyof ApplicationRecord;
  label: string;
  type?: FieldDisplayType;
}

export interface FieldGroup {
  title: string;
  fields: FieldMeta[];
}

// Mirrors the 10 sections + final declaration from the source application
// (Grant Application Questions.docx, Q1–Q47) — used to render the admin
// application detail view and to order/label the CSV export.
export const APPLICATION_FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Personal Information",
    fields: [
      { key: "applicantName", label: "Full name" },
      { key: "gender", label: "Gender" },
      { key: "dateOfBirth", label: "Date of birth", type: "date" },
      { key: "phone", label: "Phone number" },
      { key: "email", label: "Email address" },
      { key: "stateOfResidence", label: "State of residence" },
      { key: "lga", label: "Local Government Area" },
      { key: "linkedin", label: "LinkedIn profile" },
      { key: "businessSocialHandle", label: "Business social handle" },
    ],
  },
  {
    title: "Entrepreneur Profile",
    fields: [
      { key: "currentStatus", label: "Current status" },
      { key: "hasPriorBusiness", label: "Prior business experience" },
      { key: "priorBusinessDescription", label: "Prior business description" },
    ],
  },
  {
    title: "Business Information",
    fields: [
      { key: "businessName", label: "Business name" },
      { key: "businessDescription", label: "Business description" },
      { key: "industry", label: "Industry" },
      { key: "supportCategory", label: "Support category" },
    ],
  },
  {
    title: "Business Stage & Operations",
    fields: [
      { key: "businessStage", label: "Business stage" },
      { key: "operatingDuration", label: "Operating duration" },
      { key: "dateEstablished", label: "Date established", type: "date" },
      { key: "registrationStatus", label: "Registration status" },
      { key: "cacNumber", label: "CAC registration number" },
      { key: "operatingLocation", label: "Operating location" },
      { key: "employeeCount", label: "Employee count" },
    ],
  },
  {
    title: "Revenue & Business Performance",
    fields: [
      { key: "hasRevenue", label: "Generating revenue" },
      { key: "avgMonthlyRevenue", label: "Average monthly revenue" },
      { key: "revenueLast12Months", label: "Revenue (last 12 months)" },
      { key: "mainCustomers", label: "Main customers" },
      { key: "customerAcquisitionChannels", label: "Customer acquisition channels", type: "list" },
    ],
  },
  {
    title: "Funding Need & Business Needs",
    fields: [
      { key: "grantAmountRequested", label: "Grant amount requested", type: "currency" },
      { key: "fundingUse", label: "Funding use", type: "list" },
      { key: "fundingGrowthExplanation", label: "How funding helps growth" },
      { key: "biggestChallenge", label: "Biggest challenge" },
    ],
  },
  {
    title: "Entrepreneur Vision & Impact",
    fields: [
      { key: "whyStartBusiness", label: "Why you started the business" },
      { key: "problemSolved", label: "Problem solved" },
      { key: "desiredImpact", label: "Desired impact" },
      { key: "fiveYearVision", label: "Five-year vision" },
      { key: "jobsToCreate", label: "Jobs to create" },
    ],
  },
  {
    title: "Grant Application Questions",
    fields: [
      { key: "whyApplying", label: "Why applying" },
      { key: "whySelected", label: "Why you should be selected" },
      { key: "whatMakesDifferent", label: "What makes the business different" },
      { key: "appliedBefore", label: "Applied for a grant before" },
      { key: "receivedFundingBefore", label: "Received funding before" },
      { key: "priorFundingDetails", label: "Prior funding details" },
    ],
  },
  {
    title: "Business Training Commitment",
    fields: [
      { key: "willingAcademy", label: "Willing — Business Training" },
      { key: "willingMentorship", label: "Willing — mentorship" },
      { key: "improvementAreas", label: "Improvement areas", type: "list" },
    ],
  },
  {
    title: "Referral Information",
    fields: [
      { key: "howHeard", label: "How you heard about the program" },
      { key: "entrepreneurNetwork", label: "Entrepreneur network" },
    ],
  },
  {
    title: "Final Declaration",
    fields: [{ key: "declarationAgreed", label: "Declaration", type: "boolean" }],
  },
];

export function formatFieldValue(record: ApplicationRecord, field: FieldMeta): string {
  const raw = record[field.key];
  if (field.type === "list") {
    return Array.isArray(raw) && raw.length ? raw.join(", ") : "—";
  }
  if (field.type === "currency") {
    const n = Number(raw);
    return n ? `₦${n.toLocaleString()}` : "—";
  }
  if (field.type === "boolean") {
    return raw ? "Agreed ✓" : "Not agreed";
  }
  if (field.type === "date" && typeof raw === "string" && raw) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  }
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "");
  return s || "—";
}
