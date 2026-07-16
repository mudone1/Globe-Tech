"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { User, Building2, Wallet, Compass, ClipboardCheck, Sparkles } from "lucide-react";
import { recordVisit, submitApplication } from "@/app/apply/[token]/actions";
import type { SubmitApplicationInput } from "@/app/apply/[token]/actions";
import CopyButton from "@/components/CopyButton";
import Stepper from "@/components/Stepper";

const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

const INDUSTRIES = [
  "Agriculture & Agribusiness", "Technology & Software", "Education", "Healthcare",
  "FinTech", "Manufacturing", "Retail & E-commerce", "Fashion & Beauty",
  "Food & Hospitality", "Logistics & Transportation", "Real Estate",
  "Creative Industry", "Professional Services", "Renewable Energy", "Other",
];

const SUPPORT_CATEGORIES = [
  "Startup Capital Support",
  "Scaling Capital Support",
  "Expansion Capital Support",
];

const CURRENT_STATUS_OPTIONS = [
  "Full-time entrepreneur",
  "Part-time entrepreneur",
  "Student entrepreneur",
  "Employee running a business",
  "Aspiring entrepreneur (business yet to start)",
];

const BUSINESS_STAGE_OPTIONS = [
  "Idea Stage (Business concept only, not yet launched)",
  "Pre-launch Stage (Preparing to start)",
  "Early Stage (0–2 years in operation)",
  "Growth Stage (2–5 years in operation)",
  "Established Stage (5+ years in operation)",
];

const OPERATING_DURATION_OPTIONS = [
  "Yet to start operations",
  "Less than 6 months",
  "6 months – 1 year",
  "2–3 years",
  "3–4 years",
  "5 years and above",
];

const REGISTRATION_STATUS_OPTIONS = [
  "Yes, my CAC certificate is available",
  "Yes, I have paid for registration and awaiting completion",
  "No, but I intend to register",
  "No",
];

const OPERATING_LOCATION_OPTIONS = ["Online only", "Physical location only", "Both online and physical location"];

const EMPLOYEE_COUNT_OPTIONS = ["Just me", "2–5 people", "6–10 people", "11–25 people", "More than 25 people"];

const AVG_MONTHLY_REVENUE_OPTIONS = [
  "Less than ₦50,000",
  "₦50,000 – ₦250,000",
  "₦250,000 – ₦1 Million",
  "₦1 Million – ₦5 Million",
  "Above ₦5 Million",
];

const CUSTOMER_CHANNEL_OPTIONS = [
  "Social Media", "Referrals", "Website", "Online Marketplace",
  "Physical Location", "Advertising", "Partnerships", "Other",
];

const FUNDING_USE_OPTIONS = [
  "Equipment purchase", "Inventory/stock", "Marketing and customer acquisition",
  "Technology development", "Hiring staff", "Business registration",
  "Expansion to new locations", "Product development", "Working capital", "Other",
];

const JOBS_TO_CREATE_OPTIONS = ["1–5 jobs", "6–20 jobs", "21–50 jobs", "More than 50 jobs"];

const IMPROVEMENT_AREA_OPTIONS = [
  "Business Strategy", "Marketing & Sales", "Financial Management", "Branding",
  "Digital Transformation", "Customer Acquisition", "Operations Management",
  "Leadership", "Fundraising",
];

const HOW_HEARD_OPTIONS = [
  "Social Media", "Friend/Referral", "Partner Organization", "Email", "Website", "Event", "Other",
];

const STEPS = [
  { label: "About You", icon: User },
  { label: "Your Business", icon: Building2 },
  { label: "Revenue & Funding", icon: Wallet },
  { label: "Vision & Grant", icon: Compass },
  { label: "Commitment", icon: ClipboardCheck },
];

function filled(value: string | number | boolean | string[] | undefined): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  return false;
}

/** Reveals its children with a soft fade/slide-in once `show` becomes true, so each
 * step feels like one question leading to the next rather than a wall of fields. */
function Reveal({
  show,
  children,
  delay = 0,
}: {
  show: boolean;
  children: React.ReactNode;
  /** Optional stagger, in seconds, for fields that appear together (e.g. two optional fields at once). */
  delay?: number;
}) {
  if (!show) return null;
  return (
    <div className="field-reveal" style={delay ? { animationDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}

/** A small chat-style message from the "assistant" side of the form, used to bridge
 * between one answered field and the next question — makes the flow feel like a
 * conversation rather than a form draining fields off a list. */
function ChatBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Sparkles size={12} />
      </div>
      <p className="text-sm leading-relaxed text-ink/80">{text}</p>
    </div>
  );
}

/** Reveals a short chat acknowledgment first, then the next question a beat behind it,
 * so answering a field feels like getting a reply before the next question drops. */
function AckReveal({ show, ack, children }: { show: boolean; ack: string; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="field-reveal space-y-3">
      <ChatBubble text={ack} />
      <div className="field-reveal" style={{ animationDelay: "0.22s" }}>
        {children}
      </div>
    </div>
  );
}

interface Props {
  token: string;
  referralResolved: boolean;
}

type FormState = Omit<SubmitApplicationInput, "token" | "honeypot">;

const initialState: FormState = {
  applicantName: "",
  gender: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  stateOfResidence: "",
  lga: "",
  linkedin: "",
  businessSocialHandle: "",

  currentStatus: "",
  hasPriorBusiness: "",
  priorBusinessDescription: "",

  businessName: "",
  businessDescription: "",
  industry: "",
  supportCategory: "",

  businessStage: "",
  operatingDuration: "",
  dateEstablished: "",
  registrationStatus: "",
  cacNumber: "",
  operatingLocation: "",
  employeeCount: "",

  hasRevenue: "",
  avgMonthlyRevenue: "",
  revenueLast12Months: "",
  mainCustomers: "",
  customerAcquisitionChannels: [],

  grantAmountRequested: 0,
  fundingUse: [],
  fundingGrowthExplanation: "",
  biggestChallenge: "",

  whyStartBusiness: "",
  problemSolved: "",
  desiredImpact: "",
  fiveYearVision: "",
  jobsToCreate: "",

  whyApplying: "",
  whySelected: "",
  whatMakesDifferent: "",
  appliedBefore: "",
  receivedFundingBefore: "",
  priorFundingDetails: "",

  willingAcademy: "",
  willingMentorship: "",
  improvementAreas: [],

  howHeard: "",
  entrepreneurNetwork: "",

  declarationAgreed: false,
};

export default function ApplicationForm({ token }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    recordVisit(token).catch(() => {
      /* non-fatal — the token in the URL still works at submit time */
    });
    try {
      window.localStorage.setItem("gt_ref_token", token);
    } catch {
      /* localStorage may be unavailable (private browsing); cookie fallback still applies */
    }
  }, [token]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleArrayValue(key: "customerAcquisitionChannels" | "fundingUse" | "improvementAreas", value: string) {
    setForm((f) => {
      const current = f[key];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...f, [key]: next };
    });
  }

  function validateStep1(): string | null {
    if (!form.applicantName.trim()) return "Enter your full name.";
    if (!form.gender) return "Select your gender.";
    if (!form.dateOfBirth) return "Enter your date of birth.";
    if (!/^[0-9+()\-\s]{7,}$/.test(form.phone)) return "Enter a valid phone number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address.";
    if (!form.stateOfResidence) return "Select your state of residence.";
    if (!form.lga.trim()) return "Enter your Local Government Area.";
    if (!form.currentStatus) return "Select what best describes your current status.";
    if (!form.hasPriorBusiness) return "Let us know if you've previously started or managed a business.";
    if (form.hasPriorBusiness === "Yes" && !form.priorBusinessDescription.trim())
      return "Briefly describe your previous business experience.";
    return null;
  }

  function validateStep2(): string | null {
    if (!form.businessName.trim()) return "Enter your business name.";
    if (!form.businessDescription.trim()) return "Briefly describe your business.";
    if (!form.industry) return "Select your business industry.";
    if (!form.supportCategory) return "Select the category of support you're applying for.";
    if (!form.businessStage) return "Select your business stage.";
    if (!form.operatingDuration) return "Select how long your business has been operating.";
    if (!form.dateEstablished) return "Enter the date your business was established.";
    if (!form.registrationStatus) return "Select your business registration status.";
    if (!form.operatingLocation) return "Select where your business currently operates.";
    if (!form.employeeCount) return "Select how many people currently work in your business.";
    return null;
  }

  function validateStep3(): string | null {
    if (!form.hasRevenue) return "Let us know if your business has started generating revenue.";
    if (form.hasRevenue === "Yes" && !form.avgMonthlyRevenue) return "Select your average monthly revenue.";
    if (!form.revenueLast12Months.trim()) return "Enter your business revenue in the last 12 months.";
    if (!form.mainCustomers.trim()) return "Describe who your main customers are.";
    if (form.customerAcquisitionChannels.length === 0) return "Select how customers currently find your business.";
    if (!form.grantAmountRequested || form.grantAmountRequested <= 0)
      return "Enter how much funding you're requesting.";
    if (form.fundingUse.length === 0) return "Select what you'll use the grant funding for.";
    if (!form.fundingGrowthExplanation.trim()) return "Explain how the funding will help your business grow.";
    if (!form.biggestChallenge.trim()) return "Describe the biggest challenge affecting your business growth.";
    return null;
  }

  function validateStep4(): string | null {
    if (!form.whyStartBusiness.trim()) return "Tell us why you started this business.";
    if (!form.problemSolved.trim()) return "Describe the problem your business solves.";
    if (!form.desiredImpact.trim()) return "Describe the impact you hope to create.";
    if (!form.fiveYearVision.trim()) return "Tell us where you see your business in 5 years.";
    if (!form.jobsToCreate) return "Select how many jobs you hope to create.";
    if (!form.whyApplying.trim()) return "Tell us why you're applying for this program.";
    if (!form.whySelected.trim()) return "Tell us why your business should be selected.";
    if (!form.whatMakesDifferent.trim()) return "Tell us what makes your business different.";
    if (!form.appliedBefore) return "Let us know if you've applied for a grant opportunity before.";
    if (form.appliedBefore === "Yes" && !form.receivedFundingBefore)
      return "Let us know if you received funding previously.";
    return null;
  }

  function validateStep5(): string | null {
    if (!form.willingAcademy) return "Let us know if you're willing to join the Business Academy training.";
    if (!form.willingMentorship) return "Let us know if you can commit time to mentorship and assignments.";
    if (form.improvementAreas.length === 0) return "Select at least one area of business development to improve.";
    if (!form.howHeard) return "Select how you heard about the program.";
    if (!form.declarationAgreed) return "Please confirm the final declaration to submit.";
    return null;
  }

  function goNext() {
    const validators = [validateStep1, validateStep2, validateStep3, validateStep4, validateStep5];
    const error = validators[step - 1]!();
    if (error) {
      setErrors(error);
      return;
    }
    setErrors(null);
    setStep((s) => s + 1);
  }

  function goBack() {
    setErrors(null);
    setStep((s) => s - 1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validateStep5();
    if (error) {
      setErrors(error);
      return;
    }
    setErrors(null);

    startTransition(async () => {
      const result = await submitApplication({
        token,
        ...form,
        honeypot,
      });

      if (!result.ok) {
        setErrors(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmittedCode(result.firstBankReferralCode ?? null);
    });
  }

  const firstName = form.applicantName.trim().split(/\s+/)[0] || "";
  const bizName = form.businessName.trim();

  const coachMessage = useMemo(() => {
    if (step === 1) {
      if (!form.applicantName.trim()) {
        return "Hi! I'm here to make this quick and painless. Let's start with a bit about you — no rush.";
      }
      if (!form.currentStatus) {
        return `Good to meet you, ${firstName}. Tell me a little about where you're at as an entrepreneur.`;
      }
      if (form.hasPriorBusiness === "Yes") {
        return `Running a business before is real experience, ${firstName} — it'll help your case here.`;
      }
      return `Thanks, ${firstName}. One more question here, then we'll get into your business.`;
    }
    if (step === 2) {
      if (!form.businessName.trim()) {
        return "Now for the fun part — tell me about the business itself.";
      }
      if (!form.industry) {
        return `${bizName} — nice. What space is it operating in?`;
      }
      if (form.businessStage?.startsWith("Idea") || form.businessStage?.startsWith("Pre-launch")) {
        return `An early-stage idea is exactly the kind of thing this grant exists for. Let's map out where things stand.`;
      }
      return `Good, this is giving me a clear picture of ${bizName || "your business"}.`;
    }
    if (step === 3) {
      if (!form.hasRevenue) {
        return "No judgment either way here — pre-revenue or already earning, both are valid starting points.";
      }
      if (form.grantAmountRequested > 0) {
        return `₦${form.grantAmountRequested.toLocaleString()} — got it. Let's make sure the reviewers understand exactly why.`;
      }
      return "This section is where the numbers start telling your story — take your time.";
    }
    if (step === 4) {
      if (!form.whyStartBusiness.trim()) {
        return `This is the part reviewers actually remember, ${firstName}. Your honest reason for starting matters more than polish.`;
      }
      if (form.whyStartBusiness.trim().split(/\s+/).length > 12) {
        return "That's a strong reason — it comes through. Keep going.";
      }
      return "A few more reflective questions, then some quick admin ones.";
    }
    return "Almost done — just your commitments and a final confirmation left.";
  }, [step, form.applicantName, form.currentStatus, form.hasPriorBusiness, form.businessName, form.industry, form.businessStage, form.hasRevenue, form.grantAmountRequested, form.whyStartBusiness, firstName, bizName]);

  if (submittedCode) {
    return (
      <div className="rounded-card border border-line bg-white p-8 shadow-sm">
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-goldSoft px-3 py-1 text-sm font-medium text-gold">
          Application received
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
          Check your email for the next step
        </h2>
        <p className="mt-2 text-slate">
          Phase 2 is opening your FirstBank account. Enter the code below in the{" "}
          <strong>Referral</strong> field on FirstBank&rsquo;s account-opening form.
        </p>

        <div className="mt-6 rounded-card border border-line bg-paper p-6 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate">
            Your referral code
          </p>
          <p className="font-mono text-3xl font-bold tracking-wider text-ink">{submittedCode}</p>
          <div className="mt-4 flex justify-center">
            <CopyButton value={submittedCode} label="Copy code" />
          </div>
        </div>

        <p className="mt-6 text-sm text-slate">
          We&rsquo;ve also emailed this code to <strong>{form.email}</strong> along with exactly
          where to enter it on FirstBank&rsquo;s form.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-white p-8 shadow-sm">
      <div className="mb-6">
        <Stepper steps={STEPS} current={step} />
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-card border border-brand/20 bg-brand/5 p-4">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Sparkles size={14} />
        </div>
        <p className="text-sm leading-relaxed text-ink">{coachMessage}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div key={step} className="step-enter space-y-5">
        {step === 1 && (() => {
          const showGender = filled(form.applicantName);
          const showDob = showGender && filled(form.gender);
          const showPhone = showDob && filled(form.dateOfBirth);
          const showEmail = showPhone && filled(form.phone);
          const showState = showEmail && filled(form.email);
          const showLga = showState && filled(form.stateOfResidence);
          const showOptionalContacts = showLga && filled(form.lga);
          const showEntrepreneurProfile = showOptionalContacts;
          const showPriorBusiness = showEntrepreneurProfile && filled(form.currentStatus);

          return (
            <>
              <SectionHeading title="Personal Information" />
              <Field label="Full name" required>
                <input
                  className="input"
                  value={form.applicantName}
                  onChange={(e) => update("applicantName", e.target.value)}
                  autoComplete="name"
                />
              </Field>

              <AckReveal show={showGender} ack={`Hi ${firstName || "there"}! Hope you're doing well today — just a bit more about you before we get into the business side.`}>
                <RadioGroup
                  label="Gender"
                  required
                  options={["Male", "Female", "Prefer not to say"]}
                  value={form.gender}
                  onChange={(v) => update("gender", v)}
                />
              </AckReveal>

              <AckReveal show={showDob} ack="Thanks — noted.">
                <Field label="Date of birth" required>
                  <input
                    className="input"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => update("dateOfBirth", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showPhone} ack="Got it.">
                <Field label="Phone number" required>
                  <input
                    className="input"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    autoComplete="tel"
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showEmail} ack="Perfect.">
                <Field label="Email address" required>
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    autoComplete="email"
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showState} ack="Great, almost done with your bio.">
                <Field label="State of residence" required>
                  <select
                    className="input"
                    value={form.stateOfResidence}
                    onChange={(e) => update("stateOfResidence", e.target.value)}
                  >
                    <option value="">Select a state</option>
                    {NIGERIA_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </AckReveal>

              <AckReveal show={showLga} ack="Nice — just need your LGA to pinpoint that.">
                <Field label="Local Government Area" required>
                  <input className="input" value={form.lga} onChange={(e) => update("lga", e.target.value)} />
                </Field>
              </AckReveal>

              <AckReveal show={showOptionalContacts} ack="That's your bio sorted. A couple of optional links, if you have them.">
                <Field label="LinkedIn profile (optional)">
                  <input
                    className="input"
                    value={form.linkedin}
                    onChange={(e) => update("linkedin", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <Reveal show={showOptionalContacts} delay={0.3}>
                <Field label="Social media handle(s) for your business (optional)">
                  <input
                    className="input"
                    value={form.businessSocialHandle}
                    onChange={(e) => update("businessSocialHandle", e.target.value)}
                  />
                </Field>
              </Reveal>

              <AckReveal show={showEntrepreneurProfile} ack="Now let's talk about you as an entrepreneur.">
                <>
                  <SectionHeading title="Entrepreneur Profile" />
                  <RadioGroup
                    label="What best describes your current status?"
                    required
                    options={CURRENT_STATUS_OPTIONS}
                    value={form.currentStatus}
                    onChange={(v) => update("currentStatus", v)}
                  />
                </>
              </AckReveal>

              <AckReveal show={showPriorBusiness} ack="Good to know.">
                <RadioGroup
                  label="Have you previously started or managed a business before?"
                  required
                  options={["Yes", "No"]}
                  value={form.hasPriorBusiness}
                  onChange={(v) => update("hasPriorBusiness", v)}
                />
              </AckReveal>

              {showPriorBusiness && form.hasPriorBusiness === "Yes" && (
                <AckReveal show={true} ack="Nice — tell me a bit more about that.">
                  <Field label="Briefly describe your previous business experience" required>
                    <textarea
                      className="input min-h-[100px]"
                      value={form.priorBusinessDescription}
                      onChange={(e) => update("priorBusinessDescription", e.target.value)}
                    />
                  </Field>
                </AckReveal>
              )}
            </>
          );
        })()}

        {step === 2 && (() => {
          const showDescription = filled(form.businessName);
          const showIndustry = showDescription && filled(form.businessDescription);
          const showSupportCategory = showIndustry && filled(form.industry);
          const showStage = showSupportCategory && filled(form.supportCategory);
          const showDuration = showStage && filled(form.businessStage);
          const showDateEstablished = showDuration && filled(form.operatingDuration);
          const showRegistrationStatus = showDateEstablished && filled(form.dateEstablished);
          const showAfterRegistration = showRegistrationStatus && filled(form.registrationStatus);
          const showEmployeeCount = showAfterRegistration && filled(form.operatingLocation);

          return (
            <>
              <SectionHeading title="Business Information" />
              <Field label="Business name" required>
                <input
                  className="input"
                  value={form.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                />
              </Field>

              <AckReveal show={showDescription} ack={`${bizName || "That name"} — nice. What does it actually do?`}>
                <Field label="Briefly describe your business" required>
                  <textarea
                    className="input min-h-[100px]"
                    placeholder="What products/services do you provide?"
                    value={form.businessDescription}
                    onChange={(e) => update("businessDescription", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showIndustry} ack="Got it, that gives me a clear picture.">
                <Field label="What industry does your business operate in?" required>
                  <select
                    className="input"
                    value={form.industry}
                    onChange={(e) => update("industry", e.target.value)}
                  >
                    <option value="">Select an industry</option>
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </Field>
              </AckReveal>

              <AckReveal show={showSupportCategory} ack="Makes sense.">
                <RadioGroup
                  label="What category of support are you applying for?"
                  required
                  options={SUPPORT_CATEGORIES}
                  value={form.supportCategory}
                  onChange={(v) => update("supportCategory", v)}
                />
              </AckReveal>

              <AckReveal show={showStage} ack="Good — now let's talk about where things stand operationally.">
                <>
                  <SectionHeading title="Business Stage & Operations" />
                  <RadioGroup
                    label="What stage is your business currently?"
                    required
                    options={BUSINESS_STAGE_OPTIONS}
                    value={form.businessStage}
                    onChange={(v) => update("businessStage", v)}
                  />
                </>
              </AckReveal>

              <AckReveal show={showDuration} ack="Noted.">
                <RadioGroup
                  label="How long has your business been operating?"
                  required
                  options={OPERATING_DURATION_OPTIONS}
                  value={form.operatingDuration}
                  onChange={(v) => update("operatingDuration", v)}
                />
              </AckReveal>

              <AckReveal show={showDateEstablished} ack="Thanks.">
                <Field label="Date your business was established/launched" required>
                  <input
                    className="input"
                    type="date"
                    value={form.dateEstablished}
                    onChange={(e) => update("dateEstablished", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showRegistrationStatus} ack="Okay.">
                <RadioGroup
                  label="Is your business currently registered?"
                  required
                  options={REGISTRATION_STATUS_OPTIONS}
                  value={form.registrationStatus}
                  onChange={(v) => update("registrationStatus", v)}
                />
              </AckReveal>

              <AckReveal show={showAfterRegistration} ack="Got it.">
                <Field label="CAC registration number (if available)">
                  <input
                    className="input"
                    value={form.cacNumber}
                    onChange={(e) => update("cacNumber", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <Reveal show={showAfterRegistration} delay={0.3}>
                <RadioGroup
                  label="Where does your business currently operate?"
                  required
                  options={OPERATING_LOCATION_OPTIONS}
                  value={form.operatingLocation}
                  onChange={(v) => update("operatingLocation", v)}
                />
              </Reveal>

              <AckReveal show={showEmployeeCount} ack="Almost there for this section.">
                <RadioGroup
                  label="How many people currently work in your business?"
                  required
                  options={EMPLOYEE_COUNT_OPTIONS}
                  value={form.employeeCount}
                  onChange={(v) => update("employeeCount", v)}
                />
              </AckReveal>
            </>
          );
        })()}

        {step === 3 && (() => {
          const revenueAnswered =
            filled(form.hasRevenue) && (form.hasRevenue !== "Yes" || filled(form.avgMonthlyRevenue));
          const showMainCustomers = revenueAnswered && filled(form.revenueLast12Months);
          const showChannels = showMainCustomers && filled(form.mainCustomers);
          const showGrantAmount = showChannels && form.customerAcquisitionChannels.length > 0;
          const showFundingUse = showGrantAmount && form.grantAmountRequested > 0;
          const showGrowthExplanation = showFundingUse && form.fundingUse.length > 0;
          const showBiggestChallenge = showGrowthExplanation && filled(form.fundingGrowthExplanation);

          return (
            <>
              <SectionHeading title="Revenue & Business Performance" />
              <RadioGroup
                label="Has your business started generating revenue?"
                required
                options={["Yes", "No"]}
                value={form.hasRevenue}
                onChange={(v) => update("hasRevenue", v)}
              />

              {filled(form.hasRevenue) && form.hasRevenue === "Yes" && (
                <Reveal show={true}>
                  <RadioGroup
                    label="What is your average monthly revenue?"
                    required
                    options={AVG_MONTHLY_REVENUE_OPTIONS}
                    value={form.avgMonthlyRevenue}
                    onChange={(v) => update("avgMonthlyRevenue", v)}
                  />
                </Reveal>
              )}

              <AckReveal show={revenueAnswered} ack="Thanks for being upfront about that.">
                <Field label="What was your business revenue in the last 12 months?" required>
                  <input
                    className="input"
                    value={form.revenueLast12Months}
                    onChange={(e) => update("revenueLast12Months", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showMainCustomers} ack="Good, noted.">
                <Field label="Who are your main customers?" required>
                  <textarea
                    className="input min-h-[90px]"
                    value={form.mainCustomers}
                    onChange={(e) => update("mainCustomers", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showChannels} ack="Makes sense.">
                <CheckboxGroup
                  label="How do customers currently find your business?"
                  required
                  options={CUSTOMER_CHANNEL_OPTIONS}
                  values={form.customerAcquisitionChannels}
                  onToggle={(v) => toggleArrayValue("customerAcquisitionChannels", v)}
                />
              </AckReveal>

              <AckReveal show={showGrantAmount} ack="Now the part that matters most — the funding itself.">
                <>
                  <SectionHeading title="Funding Need & Business Needs" />
                  <Field label="How much funding are you requesting (₦)?" required>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={form.grantAmountRequested || ""}
                      onChange={(e) => update("grantAmountRequested", Number(e.target.value))}
                    />
                  </Field>
                </>
              </AckReveal>

              <AckReveal
                show={showFundingUse}
                ack={
                  form.grantAmountRequested > 0
                    ? `₦${form.grantAmountRequested.toLocaleString()} — got it.`
                    : "Got it."
                }
              >
                <CheckboxGroup
                  label="What will you use the grant funding for?"
                  required
                  options={FUNDING_USE_OPTIONS}
                  values={form.fundingUse}
                  onToggle={(v) => toggleArrayValue("fundingUse", v)}
                />
              </AckReveal>

              <AckReveal show={showGrowthExplanation} ack="Good choices.">
                <Field label="Explain specifically how this funding will help your business grow" required>
                  <textarea
                    className="input min-h-[100px]"
                    value={form.fundingGrowthExplanation}
                    onChange={(e) => update("fundingGrowthExplanation", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showBiggestChallenge} ack="That's helpful context.">
                <Field label="What is the biggest challenge currently affecting your business growth?" required>
                  <textarea
                    className="input min-h-[100px]"
                    value={form.biggestChallenge}
                    onChange={(e) => update("biggestChallenge", e.target.value)}
                  />
                </Field>
              </AckReveal>
            </>
          );
        })()}

        {step === 4 && (() => {
          const showProblemSolved = filled(form.whyStartBusiness);
          const showDesiredImpact = showProblemSolved && filled(form.problemSolved);
          const showFiveYearVision = showDesiredImpact && filled(form.desiredImpact);
          const showJobsToCreate = showFiveYearVision && filled(form.fiveYearVision);
          const showWhyApplying = showJobsToCreate && filled(form.jobsToCreate);
          const showWhySelected = showWhyApplying && filled(form.whyApplying);
          const showWhatMakesDifferent = showWhySelected && filled(form.whySelected);
          const showAppliedBefore = showWhatMakesDifferent && filled(form.whatMakesDifferent);

          return (
            <>
              <SectionHeading title="Entrepreneur Vision & Impact" />
              <Field label={`Why did you start ${bizName || "this business"}?`} required>
                <textarea
                  className="input min-h-[100px]"
                  value={form.whyStartBusiness}
                  onChange={(e) => update("whyStartBusiness", e.target.value)}
                />
                {form.whyStartBusiness.trim().split(/\s+/).length > 12 && (
                  <p className="mt-1.5 text-xs text-brand">That comes through clearly — thank you for sharing it.</p>
                )}
              </Field>

              <AckReveal
                show={showProblemSolved}
                ack={
                  form.whyStartBusiness.trim().split(/\s+/).length > 12
                    ? "That comes through clearly — thanks for sharing that."
                    : "Thanks for sharing that."
                }
              >
                <Field label="What problem does your business solve?" required>
                  <textarea
                    className="input min-h-[100px]"
                    value={form.problemSolved}
                    onChange={(e) => update("problemSolved", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showDesiredImpact} ack="Good — that's an important problem to solve.">
                <Field label="What impact do you hope to create through your business?" required>
                  <textarea
                    className="input min-h-[100px]"
                    value={form.desiredImpact}
                    onChange={(e) => update("desiredImpact", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showFiveYearVision} ack="I like that.">
                <Field label={`Where do you see ${bizName || "your business"} in the next 5 years?`} required>
                  <textarea
                    className="input min-h-[100px]"
                    value={form.fiveYearVision}
                    onChange={(e) => update("fiveYearVision", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showJobsToCreate} ack="Exciting to hear.">
                <RadioGroup
                  label="How many jobs do you hope to create through your business?"
                  required
                  options={JOBS_TO_CREATE_OPTIONS}
                  value={form.jobsToCreate}
                  onChange={(v) => update("jobsToCreate", v)}
                />
              </AckReveal>

              <AckReveal show={showWhyApplying} ack="Great vision — now a few questions specifically about this grant.">
                <>
                  <SectionHeading title="Grant Application Questions" />
                  <Field label="Why are you applying for the Globe Tech SME Grant & Business Support Program?" required>
                    <textarea
                      className="input min-h-[100px]"
                      value={form.whyApplying}
                      onChange={(e) => update("whyApplying", e.target.value)}
                    />
                  </Field>
                </>
              </AckReveal>

              <AckReveal show={showWhySelected} ack="Noted.">
                <Field label="Why should your business be selected for this grant opportunity?" required>
                  <textarea
                    className="input min-h-[100px]"
                    value={form.whySelected}
                    onChange={(e) => update("whySelected", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showWhatMakesDifferent} ack="Good case.">
                <Field label="What makes your business different from others in your industry?" required>
                  <textarea
                    className="input min-h-[100px]"
                    value={form.whatMakesDifferent}
                    onChange={(e) => update("whatMakesDifferent", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <AckReveal show={showAppliedBefore} ack="That's a clear differentiator.">
                <RadioGroup
                  label="Have you applied for a grant opportunity before?"
                  required
                  options={["Yes", "No"]}
                  value={form.appliedBefore}
                  onChange={(v) => update("appliedBefore", v)}
                />
              </AckReveal>

              {showAppliedBefore && form.appliedBefore === "Yes" && (
                <AckReveal show={true} ack="Okay, tell me more.">
                  <>
                    <RadioGroup
                      label="If yes, did you receive funding?"
                      required
                      options={["Yes", "No"]}
                      value={form.receivedFundingBefore}
                      onChange={(v) => update("receivedFundingBefore", v)}
                    />
                    <Field label="Please share details">
                      <textarea
                        className="input min-h-[80px]"
                        value={form.priorFundingDetails}
                        onChange={(e) => update("priorFundingDetails", e.target.value)}
                      />
                    </Field>
                  </>
                </AckReveal>
              )}
            </>
          );
        })()}

        {step === 5 && (() => {
          const showMentorship = filled(form.willingAcademy);
          const showImprovementAreas = showMentorship && filled(form.willingMentorship);
          const showHowHeard = showImprovementAreas && form.improvementAreas.length > 0;
          const showFinal = showHowHeard && filled(form.howHeard);

          return (
            <>
              <SectionHeading title="Business Academy Commitment" />
              <RadioGroup
                label="Are you willing to participate in the Globe Tech Business Academy training sessions if selected?"
                required
                options={["Yes", "No"]}
                value={form.willingAcademy}
                onChange={(v) => update("willingAcademy", v)}
              />

              <AckReveal show={showMentorship} ack="Good.">
                <RadioGroup
                  label="Are you willing to commit time to mentorship sessions, assignments, and business improvement activities?"
                  required
                  options={["Yes", "No"]}
                  value={form.willingMentorship}
                  onChange={(v) => update("willingMentorship", v)}
                />
              </AckReveal>

              <AckReveal show={showImprovementAreas} ack="Great.">
                <CheckboxGroup
                  label="What areas of business development would you like to improve?"
                  required
                  options={IMPROVEMENT_AREA_OPTIONS}
                  values={form.improvementAreas}
                  onToggle={(v) => toggleArrayValue("improvementAreas", v)}
                />
              </AckReveal>

              <AckReveal show={showHowHeard} ack="Just a couple more questions and you're done.">
                <>
                  <SectionHeading title="Referral Information" />
                  <RadioGroup
                    label="How did you hear about the Globe Tech SME Grant & Business Support Program?"
                    required
                    options={HOW_HEARD_OPTIONS}
                    value={form.howHeard}
                    onChange={(v) => update("howHeard", v)}
                  />
                </>
              </AckReveal>

              <AckReveal show={showFinal} ack={`Almost there, ${firstName || "friend"} — just the final confirmation left.`}>
                <Field label="Do you belong to any entrepreneur/community/business network? (optional)">
                  <textarea
                    className="input min-h-[80px]"
                    value={form.entrepreneurNetwork}
                    onChange={(e) => update("entrepreneurNetwork", e.target.value)}
                  />
                </Field>
              </AckReveal>

              <Reveal show={showFinal} delay={0.3}>
                <>
                  <SectionHeading title="Final Declaration" />
                  <label className="flex items-start gap-3 rounded-card border border-line bg-paper p-4 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0"
                      checked={form.declarationAgreed}
                      onChange={(e) => update("declarationAgreed", e.target.checked)}
                    />
                    <span>
                      I confirm that the information provided in this application is accurate and
                      complete. I understand that submission of this application does not guarantee
                      funding and that selected applicants may undergo further evaluation.
                    </span>
                  </label>
                </>
              </Reveal>
            </>
          );
        })()}
        </div>

        {/* Honeypot — visually hidden, never in the tab order, present on every step */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {errors && (
          <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
            {errors}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          {step > 1 && (
            <button type="button" onClick={goBack} className="btn-secondary flex-1">
              Back
            </button>
          )}
          {step < 5 && (
            <button type="button" onClick={goNext} className="btn-primary flex-1">
              Continue
            </button>
          )}
          {step === 5 && (
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? "Submitting…" : "Submit application"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h3 className="!mt-8 border-b border-line pb-2 font-display text-sm font-semibold uppercase tracking-wide text-slate first:!mt-0">
      {title}
    </h3>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label} {required && <span className="text-gold">*</span>}
      </span>
      {children}
    </label>
  );
}

function RadioGroup({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">
        {label} {required && <span className="text-gold">*</span>}
      </legend>
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              value === opt ? "border-brand bg-brand/5 text-ink" : "border-line text-ink hover:bg-paper"
            }`}
          >
            <input
              type="radio"
              className="h-4 w-4 shrink-0"
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CheckboxGroup({
  label,
  options,
  values,
  onToggle,
  required,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (v: string) => void;
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">
        {label} {required && <span className="text-gold">*</span>}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <label
            key={opt}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              values.includes(opt) ? "border-brand bg-brand/5 text-ink" : "border-line text-ink hover:bg-paper"
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0"
              checked={values.includes(opt)}
              onChange={() => onToggle(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
