"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { NIGERIA_STATES } from "@/lib/nigeriaStates";
import { ROLE_CONFIGS, type SignupRole } from "@/lib/staffRoles";
import { submitStaffRegistration } from "@/app/signup/register/actions";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const params = useSearchParams();
  const roleParam = params.get("role");
  const role = roleParam && roleParam in ROLE_CONFIGS ? (roleParam as SignupRole) : null;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [referrerCode, setReferrerCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ staffId: string; pendingApproval: boolean; setupToken: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!role) {
    return (
      <AuthLayout>
        <h1 className="font-display text-2xl font-semibold text-ink">Role not recognized</h1>
        <p className="mt-2 text-sm text-slate">
          Pick a role from the signup page to continue.
        </p>
        <Link href="/signup" className="btn-primary mt-6 inline-block">
          Back to role selection
        </Link>
      </AuthLayout>
    );
  }

  const config = ROLE_CONFIGS[role];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await submitStaffRegistration({
        role: role!,
        fullName,
        email,
        phone,
        state,
        referrerCode: config.referrerTier ? referrerCode : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ staffId: res.staffId, pendingApproval: res.pendingApproval, setupToken: res.setupToken });
    } catch {
      setError("Something went wrong creating your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.staffId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard API can fail silently; the code is still visible on screen */
    }
  }

  function downloadCode() {
    if (!result) return;
    const blob = new Blob(
      [`Globe-Tech staff code\n\nName: ${fullName}\nRole: ${config.title}\nStaff code: ${result.staffId}\n`],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "globe-tech-staff-code.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (result) {
    return (
      <AuthLayout>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
          <CheckCircle2 size={24} className="text-brand" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink">You&rsquo;re registered</h1>
        <p className="mt-2 text-sm text-slate">
          This is your staff code — you&rsquo;ll use it to log in and to onboard anyone who reports
          to you. Save it somewhere safe.
        </p>

        <div className="mt-5 rounded-md border border-line bg-paper px-4 py-3">
          <p className="font-mono text-lg font-semibold text-ink">{result.staffId}</p>
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={copyCode} className="btn-secondary flex-1 text-sm">
            {copied ? "Copied ✓" : "Copy code"}
          </button>
          <button onClick={downloadCode} className="btn-secondary flex-1 text-sm">
            Download
          </button>
        </div>

        {result.pendingApproval && (
          <p className="mt-4 rounded-md bg-goldSoft px-3 py-2 text-sm text-ink">
            Your account needs admin approval before you can log in. You can set your password
            now — you&rsquo;ll just need to wait for approval before signing in.
          </p>
        )}

        <Link href={`/signup/set-password?token=${result.setupToken}`} className="btn-primary mt-5 block w-full text-center">
          Continue to set your password →
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <p className="font-mono text-xs uppercase tracking-widest text-gold">{config.tier}</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Sign up as {config.title}</h1>
      <p className="mt-1 text-sm text-slate">
        {config.referrerTier
          ? `You'll need a staff code from an active ${config.referrerTier}.`
          : "No referrer code needed — your account will need admin approval before you can log in."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Full name</span>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Phone number</span>
          <input
            className="input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">State</span>
          <select className="input" value={state} onChange={(e) => setState(e.target.value)} required>
            <option value="">Select a state</option>
            {NIGERIA_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {config.referrerTier && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{config.referrerLabel}</span>
            <input
              className="input font-mono"
              placeholder="e.g. GBT01R/123456789"
              value={referrerCode}
              onChange={(e) => setReferrerCode(e.target.value)}
              required
            />
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        <Link href="/signup" className="font-medium text-brand hover:underline">
          ← Choose a different role
        </Link>
      </p>
    </AuthLayout>
  );
}
