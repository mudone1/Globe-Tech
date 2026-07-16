"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { checkSetupToken, completeSetup } from "@/app/signup/set-password/actions";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError("This setup link is missing its token. Please sign up again.");
      setChecking(false);
      return;
    }
    checkSetupToken(token).then((res) => {
      if (!res.ok) {
        setTokenError(res.error);
      } else {
        setFullName(res.fullName);
        setPendingApproval(!res.active);
      }
      setChecking(false);
    });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await completeSetup(token, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong setting your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <AuthLayout>
        <p className="text-slate">Checking your setup link…</p>
      </AuthLayout>
    );
  }

  if (tokenError) {
    return (
      <AuthLayout>
        <h1 className="font-display text-2xl font-semibold text-ink">Link not valid</h1>
        <p className="mt-2 text-sm text-slate">{tokenError}</p>
        <Link href="/signup" className="btn-primary mt-6 inline-block">
          Back to sign up
        </Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <h1 className="font-display text-2xl font-semibold text-ink">Password set</h1>
        {pendingApproval ? (
          <p className="mt-2 text-sm text-slate">
            Your account is awaiting admin approval. You&rsquo;ll be able to log in once it&rsquo;s
            approved — we appreciate your patience.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate">You&rsquo;re all set, {fullName}. You can log in now.</p>
        )}
        <Link href="/admin/login" className="btn-primary mt-6 inline-block">
          Go to login →
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold text-ink">Set your password, {fullName}</h1>
      <p className="mt-1 text-sm text-slate">One last step before you can log in.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <span className="mt-1 block text-xs text-slate">At least 6 characters.</span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Confirm password</span>
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Setting password…" : "Set password"}
        </button>
      </form>
    </AuthLayout>
  );
}
