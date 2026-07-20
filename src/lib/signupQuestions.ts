import { NIGERIA_STATES } from "@/lib/nigeriaStates";
import { ROLE_CONFIGS, type SignupRole } from "@/lib/staffRoles";

export type SQType = "text" | "email" | "tel" | "select" | "multiselect" | "quickreply" | "textarea" | "mou" | "checkbox";

export interface SignupQuestion {
  id: string;
  type: SQType;
  label: string; // shown on the summary screen
  question: string;
  placeholder?: string;
  options?: string[];
  required?: boolean; // defaults to true
  minSelect?: number; // multiselect only — minimum options that must be checked
}

export const MOU_ITEMS = [
  "Represent and protect the reputation of Globe-Tech and its strategic partners.",
  "Treat every business owner fairly.",
  "Protect confidential information.",
  "Never collect customer funds.",
  "Never misuse customer information.",
  "Follow Globe-Tech policies.",
  "Report fraud or misconduct immediately.",
  "Understand incentives are paid only under Globe-Tech programme policies following validation and payment by the partner institution.",
];

export const DECLARATION_TEXT =
  "I confirm that I have read and understood this Declaration and agree to comply with Globe-Tech's professional standards, confidentiality obligations and programme requirements. I understand that any breach may result in disciplinary action, termination and referral to the appropriate authorities.";

const SOCIAL_PLATFORMS = ["Facebook", "Instagram", "X", "LinkedIn"];
export const REGIONAL_SPECIALIZATIONS = ["Globe-Tech Regional Marketing Lead", "Data analysis"];

const TAIL: SignupQuestion[] = [
  {
    id: "ninNumber",
    type: "tel",
    label: "NIN",
    question: "Last thing before the paperwork — what's your National Identification Number (NIN)?",
    placeholder: "12345678901",
  },
  {
    id: "mouAccepted",
    type: "mou",
    label: "MOU acknowledgment",
    question: "Please read each statement below and check them all to acknowledge your agreement.",
  },
  {
    id: "declarationAccepted",
    type: "checkbox",
    label: "Declaration",
    question: "Almost done — please read this declaration and confirm.",
  },
];

export function getSignupQuestions(role: SignupRole): SignupQuestion[] {
  const config = ROLE_CONFIGS[role];

  const head: SignupQuestion[] = [
    { id: "firstName", type: "text", label: "First name", question: "Let's get you set up — what's your first name?" },
    { id: "middleName", type: "text", label: "Middle name", question: "Middle name? Skip this one if you don't have one.", required: false },
    { id: "lastName", type: "text", label: "Last name", question: "And your last name?" },
    { id: "email", type: "email", label: "Email address", question: "What's your email address?" },
    { id: "phone", type: "tel", label: "Phone (WhatsApp)", question: "Your phone number (WhatsApp)?", placeholder: "08012345678" },
    {
      id: "socialMediaPlatform",
      type: "quickreply",
      label: "Preferred social media",
      question: "Which social media platform do you use most? Optional — skip if you'd rather not say.",
      options: SOCIAL_PLATFORMS,
      required: false,
    },
    {
      id: "socialMediaUsername",
      type: "text",
      label: "Social media username",
      question: "And your username there?",
      required: false,
    },
  ];

  if (config.referrerTier) {
    head.push({
      id: "referrerCode",
      type: "text",
      label: config.referrerLabel ?? "Referrer staff code",
      question: `${config.referrerLabel}?`,
      placeholder: "GBT01S/123456789",
    });
  }

  if (role === "regional") {
    head.push({
      id: "roleSpecialization",
      type: "quickreply",
      label: "Role",
      question: "Which best describes your role?",
      options: REGIONAL_SPECIALIZATIONS,
    });
  }

  const middle: SignupQuestion[] = [
    { id: "homeAddress", type: "textarea", label: "Home address", question: "What's your home address?" },
    { id: "state", type: "select", label: "State of residence", question: "Which state do you currently live in?", options: NIGERIA_STATES },
  ];

  if (role === "state") {
    middle.push({
      id: "stateToCoordinate",
      type: "select",
      label: "State to coordinate",
      question: "Which state do you wish to coordinate?",
      options: NIGERIA_STATES,
    });
  }

  if (role === "regional") {
    middle.push({
      id: "stateOfInfluence",
      type: "multiselect",
      label: "States of influence",
      question: "And select your states of influences",
      options: NIGERIA_STATES,
      minSelect: 2,
    });
  }

  return [...head, ...middle, ...TAIL];
}
