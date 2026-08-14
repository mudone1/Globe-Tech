"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword as firebaseSignIn } from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { getSupabaseClient } from "@/lib/supabase-client";
import AuthLayout from "@/components/AuthLayout";
import { resolveLogin, checkStaffActiveAfterLogin, claimSupabasePassword } from "@/app/admin/login/actions";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const resolved = await resolveLogin(identifier);
      if (!resolved.ok) {
        setError(resolved.error);
        return;
      }

      const supabase = getSupabaseClient();
      let { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: resolved.email,
        password,
      });

      // Shadow-verify cutover path: every staff account already exists in
      // Supabase (created during the data migration) but with a password
      // nobody has set yet. A failed Supabase sign-in doesn't necessarily
      // mean a wrong password — it may just mean this account hasn't been
      // "claimed" here yet. Re-check the password against the still-live
      // Firebase Auth project; if THAT succeeds, claim it (sets this same
      // password on the Supabase account) and retry once.
      if (signInErr) {
        try {
          await firebaseSignIn(getFirebaseAuth(), resolved.email, password);
          const claimed = await claimSupabasePassword(resolved.email, password);
          if (claimed.ok) {
            const retry = await supabase.auth.signInWithPassword({ email: resolved.email, password });
            signInData = retry.data;
            signInErr = retry.error;
          }
        } catch {
          // Firebase sign-in also failed — genuinely wrong password, fall
          // through to the original Supabase error below.
        }
      }

      if (signInErr || !signInData?.session) {
        const message = signInErr?.message?.toLowerCase() ?? "";
        if (message.includes("invalid login credentials")) {
          setError("Incorrect password. Try again or use Forgot password.");
        } else if (message.includes("too many requests")) {
          setError("Too many attempts. Wait a bit and try again, or reset your password.");
        } else {
          setError(signInErr ? `Couldn't sign in: ${signInErr.message}` : "Couldn't sign in. Check your details and try again.");
        }
        return;
      }

      const { user } = signInData.session;

      // Admins land on the analytics dashboard; everyone else lands on their
      // personal dashboard. This check is best-effort — if it fails for any
      // reason, the login itself already succeeded, so we still route
      // somewhere reasonable rather than reporting a fake "login failed" for
      // what's actually a database read problem.
      try {
        const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
        if (adminRow) {
          router.push("/admin/dashboard");
          return;
        }
      } catch (adminCheckErr) {
        console.error("Admin check failed (login itself succeeded):", adminCheckErr);
        router.push("/admin/dashboard");
        return;
      }

      // Not an admin — a self-registered Regional Coordinator's account may
      // still be awaiting approval, so confirm they're actually active
      // before letting them into the dashboard.
      const accessToken = signInData.session.access_token;
      const activeCheck = await checkStaffActiveAfterLogin(accessToken);
      if (!activeCheck.ok) {
        await supabase.auth.signOut();
        setError(activeCheck.error);
        return;
      }
      if (!activeCheck.active) {
        await supabase.auth.signOut();
        setError(activeCheck.error);
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      setError("Couldn't sign in (unexpected error). Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setNotice(null);
    if (!identifier.includes("@")) {
      setError("Enter your email address above first, then click Forgot password.");
      return;
    }
    try {
      const { error: resetErr } = await getSupabaseClient().auth.resetPasswordForEmail(identifier.trim(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (resetErr) throw new Error(resetErr.message);
      setNotice("Check your email for a link to reset your password.");
    } catch (err) {
      console.error("Password reset failed:", err);
      setError("Couldn't send a reset email. Check the address and try again.");
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold text-ink">Log in</h1>
      <p className="mt-1 text-sm text-slate">Track your referrals and see how your team is doing.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Email or Staff ID</span>
          <input
            className="input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-md bg-goldSoft px-3 py-2 text-sm text-ink">{notice}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Logging in…" : "Log in"}
        </button>

        <button
          type="button"
          onClick={handleForgotPassword}
          className="block w-full text-center text-sm text-brand hover:underline"
        >
          Forgot password?
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        Don&rsquo;t have an account?{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          Sign up as a Globe-Tech coordinator
        </Link>
      </p>
    </AuthLayout>
  );
}
