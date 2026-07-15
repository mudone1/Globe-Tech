"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase-client";

export default function StaffGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      if (!u) router.replace("/admin/login");
    });
    return () => unsub();
  }, [router]);

  if (user === undefined) {
    return <div className="flex min-h-screen items-center justify-center text-slate">Loading…</div>;
  }
  if (!user) return null; // redirecting

  return <>{children}</>;
}
