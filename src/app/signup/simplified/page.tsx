"use client";

import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import AuthLayout from "@/components/AuthLayout";
import SignupChatForm from "@/components/SignupChatForm";

export default function SimplifiedSignupPage() {
  return (
    <AuthLayout>
      <header className="mb-6">
        <BrandMark size="sm" href="/" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
          Join Globe-Tech as a Marketing Officer
        </h1>
        <p className="mt-2 text-sm text-slate">
          Build your referral network, track applicants, and earn commissions.
        </p>
      </header>

      <SignupChatForm role="marketing" simplified={true} />

      <p className="mt-6 text-center text-sm text-slate">
        Already have an account?{" "}
        <Link href="/admin/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
        {" · "}
        Have an existing Staff ID from before?{" "}
        <Link href="/signup/legacy" className="font-medium text-brand hover:underline">
          Use it here
        </Link>
      </p>
    </AuthLayout>
  );
}
