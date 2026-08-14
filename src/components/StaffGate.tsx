"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";

export default function StaffGate({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(Boolean(session));
      if (!session) router.replace("/admin/login");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      if (!session) router.replace("/admin/login");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (signedIn === undefined) {
    return <div className="flex min-h-screen items-center justify-center text-slate">Loading…</div>;
  }
  if (!signedIn) return null; // redirecting

  return <>{children}</>;
}
