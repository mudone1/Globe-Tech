"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase-client";
import AuthLayout from "@/components/AuthLayout";

/**
 * Landed on from the "Forgot password" email link
 * (resetPasswordForEmail's redirectTo in admin/login/page.tsx points here).
 * Supabase's client auto-detects the recovery token in the URL and starts a
 * temporary session — this page just needs to prompt for a new password and
 * call updateUser({ password }) to finish the reset.
 */
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    // The recovery link's session is established asynchronously as the
    // client parses the URL fragment — wait for that before allowing submit.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
        return;
      }
      // Fall back to the auth-state-change event in case getSession() ran
      // before the URL fragment was processed.
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
      });
      return () => subscription.unsubscribe();
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: updateErr } = await getSupabaseClient().auth.updateUser({ password });
      if (updateErr) throw new Error(updateErr.message);
      setDone(true);
      setTimeout(() => router.push("/admin/login"), 2000);
    } catch (err) {
      console.error("Password update failed:", err);
      setError("Couldn't update your password. The reset link may have expired — request a new one from the login page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold text-ink">Set a new password</h1>
      <p className="mt-1 text-sm text-slate">Choose a new password for your Globe-Tech account.</p>

      {!ready && !done && (
        <p className="mt-6 text-sm text-slate">Verifying your reset link…</p>
      )}

      {ready && !done && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">New password</span>
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

          {error && (
            <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Saving…" : "Set new password"}
          </button>
        </form>
      )}

      {done && (
        <p className="mt-6 rounded-md bg-goldSoft px-3 py-2 text-sm text-ink">
          Password updated — taking you to the login page…
        </p>
      )}
    </AuthLayout>
  );
}
