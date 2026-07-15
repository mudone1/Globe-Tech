"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase-client";
import AuthLayout from "@/components/AuthLayout";
import { resolveLogin } from "@/app/admin/login/actions";

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

      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, resolved.email, password);

      // Admins land on the full staff/leaderboard views; everyone else lands
      // on their personal dashboard.
      const adminDoc = await getDoc(doc(getFirebaseDb(), "admins", cred.user.uid));
      router.push(adminDoc.exists() ? "/admin/staff" : "/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Incorrect password. Try again or use Forgot password.");
      } else if (code === "auth/user-not-found") {
        setError("No account found for that email/Staff ID.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Wait a bit and try again, or reset your password.");
      } else if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid") {
        setError("The app isn't configured correctly (invalid Firebase API key). Contact the admin.");
      } else {
        setError(`Couldn't sign in (${code ?? "unknown error"}). Check your details and try again.`);
      }
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
      await sendPasswordResetEmail(getFirebaseAuth(), identifier.trim());
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
          Sign up with your Staff ID
        </Link>
      </p>
    </AuthLayout>
  );
}
