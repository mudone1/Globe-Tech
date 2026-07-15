"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase-client";

/**
 * Client-side convenience gate: keeps signed-out visitors off the admin
 * pages. This is NOT the real security boundary — Firestore security rules
 * (firestore.rules) are what actually enforce who can read/write which
 * collections. Never rely on this component alone.
 */
export default function AdminGate({ children }: { children: React.ReactNode }) {
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
    return (
      <div className="flex min-h-screen items-center justify-center text-slate">Loading…</div>
    );
  }
  if (!user) return null; // redirecting

  return <>{children}</>;
}
