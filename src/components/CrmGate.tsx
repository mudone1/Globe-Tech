"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";

/**
 * Route gate for /crm — unlike AdminGate/StaffGate (which only check "is
 * anyone signed in"), this checks REAL authorization: admins always pass;
 * staff pass only if they're in public.crm_access. Both tables are
 * readable by any signed-in user via RLS, so this is a cheap client-side
 * check — the actual data underneath is independently protected by the
 * same admin-or-crm_access RLS policy on applicant_outreach and the new
 * applications_crm_read policy.
 */
export default function CrmGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/admin/login");
        return;
      }

      const uid = session.user.id;
      const [{ data: adminRow }, { data: crmRow }] = await Promise.all([
        supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle(),
        supabase.from("crm_access").select("user_id").eq("user_id", uid).maybeSingle(),
      ]);

      setStatus(adminRow || crmRow ? "allowed" : "denied");
    }
    check();
  }, [router]);

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-slate">Loading…</div>;
  }
  if (status === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-lg font-semibold text-ink">You don't have access to the CRM.</p>
        <p className="max-w-sm text-sm text-slate">Ask an admin to grant you access under Admin Settings.</p>
        <button onClick={() => router.push("/dashboard")} className="btn-secondary mt-2 text-sm">
          Back to dashboard
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
