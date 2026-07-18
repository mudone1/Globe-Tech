import { NIGERIA_STATES } from "@/lib/nigeriaStates";
import type { GrantTier } from "@/lib/grantCategories";

export type GQType = "text" | "email" | "tel" | "select" | "textarea" | "number" | "checkbox";

export interface GrantQuestion {
  id: string;
  type: GQType;
  label: string; // shown on the summary screen
  question: string;
  placeholder?: string;
  options?: string[];
  required?: boolean; // defaults to true
}

export const DECLARATION_TEXT =
  "I confirm that the information provided in this application is accurate and complete. I understand that submission does not guarantee funding — recipients are selected by random draw from eligible applicants every quarter — and that I may be contacted for further verification.";

const UNIVERSAL: GrantQuestion[] = [
  { id: "applicantName", type: "text", label: "Full name", question: "Let's get started — what's your full name?" },
  { id: "phone", type: "tel", label: "Phone number", question: "Your phone number?", placeholder: "08012345678" },
  { id: "email", type: "email", label: "Email address", question: "And your email address?" },
  { id: "stateOfResidence", type: "select", label: "State of residence", question: "Which state do you live in?", options: NIGERIA_STATES },
  { id: "businessName", type: "text", label: "Business name", question: "What's your business called?" },
  {
    id: "grantNeedExplanation",
    type: "textarea",
    label: "Why you need this grant",
    question: "Why do you need this grant, and how would it help your business?",
  },
];

const TRADER_TAIL: GrantQuestion[] = [
  { id: "businessType", type: "text", label: "Business type", question: "What type of business is it? (e.g. what do you sell)" },
  { id: "businessLocation", type: "text", label: "Business location", question: "Where do you operate? (street, market name, or shop address)" },
  {
    id: "monthlyProductCost",
    type: "number",
    label: "Approximate monthly product cost",
    question: "Roughly how much do you spend on stock/products per month (₦)?",
    placeholder: "e.g. 50000",
  },
];

function cacTail(tier: "enterprise" | "llc"): GrantQuestion[] {
  const isLlc = tier === "llc";
  return [
    {
      id: "cacNumber",
      type: "text",
      label: isLlc ? "RC number" : "BN number",
      question: isLlc ? "What's your CAC RC (company registration) number?" : "What's your CAC BN (Business Name registration) number?",
      placeholder: isLlc ? "RC1234567" : "BN1234567",
    },
    { id: "businessDescription", type: "textarea", label: "Business description", question: "Briefly, what does your business do?" },
  ];
}

const DECLARATION: GrantQuestion = {
  id: "declarationAgreed",
  type: "checkbox",
  label: "Declaration",
  question: "Last step — please read this and confirm.",
};

export function getGrantQuestions(tier: GrantTier): GrantQuestion[] {
  const tail = tier === "trader" ? TRADER_TAIL : cacTail(tier);
  return [...UNIVERSAL, ...tail, DECLARATION];
}
