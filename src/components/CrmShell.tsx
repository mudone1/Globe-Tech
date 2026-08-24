"use client";

import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";
import { LogOut, ArrowLeft } from "lucide-react";

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleSignOut() {
    await getSupabaseClient().auth.signOut();
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-slate hover:text-ink"
              aria-label="Back"
            >
              <ArrowLeft size={15} strokeWidth={2} />
            </button>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-gold">Globe-Tech</p>
              <h1 className="font-display text-lg font-semibold text-ink">CRM</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-slate hover:text-ink">
            <LogOut size={15} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</div>
    </div>
  );
}
