"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { ROLE_CONFIGS, type SignupRole } from "@/lib/staffRoles";
import SignupChatForm from "@/components/SignupChatForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterGate />
    </Suspense>
  );
}

function RegisterGate() {
  const params = useSearchParams();
  const roleParam = params.get("role");
  const role = roleParam && roleParam in ROLE_CONFIGS ? (roleParam as SignupRole) : null;

  if (!role) {
    return (
      <AuthLayout>
        <h1 className="font-display text-2xl font-semibold text-ink">Role not recognized</h1>
        <p className="mt-2 text-sm text-slate">Pick a role from the signup page to continue.</p>
        <Link href="/signup" className="btn-primary mt-5 block w-full text-center">
          Back to role selection
        </Link>
      </AuthLayout>
    );
  }

  return <SignupChatForm role={role} />;
}
