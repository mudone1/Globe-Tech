"use client";

import { useEffect, useState, useTransition } from "react";
import { User, Building2, CheckCircle2 } from "lucide-react";
import { recordVisit, submitApplication } from "@/app/apply/[token]/actions";
import CopyButton from "@/components/CopyButton";
import Stepper from "@/components/Stepper";

const BUSINESS_TYPES = [
  "Retail / Trading",
  "Agriculture / Agro-processing",
  "Manufacturing",
  "Technology / Digital services",
  "Food & Beverage",
  "Fashion / Textiles",
  "Logistics / Transport",
  "Other",
];

const STEPS = [
  { label: "Your Details", icon: User },
  { label: "Your Business", icon: Building2 },
  { label: "Review & Submit", icon: CheckCircle2 },
];

interface Props {
  token: string;
  referralResolved: boolean;
}

type FormState = {
  applicantName: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: string;
  grantAmountRequested: string;
  website: string; // honeypot — labeled to look plausible to a bot, hidden from real users
};

const initialState: FormState = {
  applicantName: "",
  email: "",
  phone: "",
  businessName: "",
  businessType: BUSINESS_TYPES[0]!,
  grantAmountRequested: "",
  website: "",
};

export default function ApplicationForm({ token }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Fire-and-forget: persists the token as a cookie fallback + localStorage,
    // so the referral survives a refresh even without the URL.
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

  function validateStep1(): string | null {
    if (!form.applicantName.trim()) return "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address.";
    if (!/^[0-9+()\-\s]{7,}$/.test(form.phone)) return "Enter a valid phone number.";
    return null;
  }

  function validateStep2(): string | null {
    if (!form.businessName.trim()) return "Enter your business name.";
    if (!form.grantAmountRequested || Number(form.grantAmountRequested) <= 0) {
      return "Enter the grant amount you're requesting.";
    }
    return null;
  }

  function goNext() {
    const error = step === 1 ? validateStep1() : validateStep2();
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
    setErrors(null);

    startTransition(async () => {
      const result = await submitApplication({
        token,
        applicantName: form.applicantName,
        email: form.email,
        phone: form.phone,
        businessName: form.businessName,
        businessType: form.businessType,
        grantAmountRequested: Number(form.grantAmountRequested),
        honeypot: form.website,
      });

      if (!result.ok) {
        setErrors(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmittedCode(result.firstBankReferralCode ?? null);
    });
  }

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
      <div className="mb-8">
        <Stepper steps={STEPS} current={step} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {step === 1 && (
          <>
            <Field label="Full name" required>
              <input
                className="input"
                value={form.applicantName}
                onChange={(e) => update("applicantName", e.target.value)}
                autoComplete="name"
              />
            </Field>

            <Field label="Email" required>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                autoComplete="email"
              />
            </Field>

            <Field label="Phone number" required>
              <input
                className="input"
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                autoComplete="tel"
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Business name" required>
              <input
                className="input"
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
              />
            </Field>

            <Field label="Business type" required>
              <select
                className="input"
                value={form.businessType}
                onChange={(e) => update("businessType", e.target.value)}
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Grant amount requested (₦)" required>
              <input
                className="input"
                type="number"
                min={0}
                value={form.grantAmountRequested}
                onChange={(e) => update("grantAmountRequested", e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <ReviewRow label="Full name" value={form.applicantName} />
            <ReviewRow label="Email" value={form.email} />
            <ReviewRow label="Phone" value={form.phone} />
            <ReviewRow label="Business name" value={form.businessName} />
            <ReviewRow label="Business type" value={form.businessType} />
            <ReviewRow
              label="Grant amount"
              value={`₦${Number(form.grantAmountRequested || 0).toLocaleString()}`}
            />
          </div>
        )}

        {/* Honeypot — visually hidden, never in the tab order, present on every step */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
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
          {step < 3 && (
            <button type="button" onClick={goNext} className="btn-primary flex-1">
              Continue
            </button>
          )}
          {step === 3 && (
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? "Submitting…" : "Submit application"}
            </button>
          )}
        </div>
      </form>
    </div>
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2 text-sm">
      <span className="text-slate">{label}</span>
      <span className="font-medium text-ink">{value || "—"}</span>
    </div>
  );
}
