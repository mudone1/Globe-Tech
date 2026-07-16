"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase-client";
import AuthLayout from "@/components/AuthLayout";
import { registerStaff } from "@/app/signup/legacy/actions";

export default function SignupPage() {
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await registerStaff({ staffId, email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Account now exists with this password — sign straight in.
      await signInWithEmailAndPassword(getFirebaseAuth(), result.email, password);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong creating your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-slate">
        Use the Staff ID you were given when you registered with Globe-Tech.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Staff ID</span>
          <input
            className="input font-mono"
            placeholder="e.g. GBT07R/115545925"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            required
          />
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
          <span className="mt-1 block text-xs text-slate">
            Use the same email you registered with, if you gave one.
          </span>
        </label>

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
        Already have an account?{" "}
        <Link href="/admin/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate">
        Never been given a Staff ID?{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          Sign up here instead
        </Link>
      </p>
    </AuthLayout>
  );
}
