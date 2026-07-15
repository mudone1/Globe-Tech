"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import BrandMark from "@/components/BrandMark";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      router.push("/admin/staff");
    } catch {
      setError("Couldn't sign in. Check your email and password and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-card border border-line bg-white p-8 shadow-sm">
        <BrandMark size="md" />
        <h1 className="mt-6 font-display text-2xl font-semibold text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-slate">Staff and admin accounts only.</p>

        <label className="mt-6 block">
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

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
