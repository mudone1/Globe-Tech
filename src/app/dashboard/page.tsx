"use client";

import { useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import StaffGate from "@/components/StaffGate";
import BrandMark from "@/components/BrandMark";
import CopyButton from "@/components/CopyButton";
import { getMyDashboardData, type DashboardData, type DashboardError } from "@/app/dashboard/actions";

export default function DashboardPage() {
  return (
    <StaffGate>
      <PersonalDashboard />
    </StaffGate>
  );
}

function PersonalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        const result: DashboardData | DashboardError = await getMyDashboardData(idToken);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setData(result);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        setError("Couldn't load your dashboard. Please try refreshing.");
      }
    }
    load();
  }, []);

  async function handleSignOut() {
    await signOut(getFirebaseAuth());
    router.push("/admin/login");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <BrandMark size="sm" href="/dashboard" />
        <button onClick={handleSignOut} className="btn-secondary text-sm">
          Sign out
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {!data && !error && <p className="text-slate">Loading your dashboard…</p>}

      {data && (
        <>
          <section className="rounded-card border border-line bg-white p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-widest text-gold">Your referral link</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{data.self.fullName}</h1>
            <p className="text-sm text-slate">{data.self.tier}</p>

            {data.self.link.startsWith("http") ? (
              <div className="mt-4 flex items-center gap-3 rounded-md bg-paper px-4 py-3">
                <span className="flex-1 truncate font-mono text-sm text-ink">{data.self.link}</span>
                <CopyButton value={data.self.link} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate">{data.self.link}</p>
            )}

            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <Stat label="Submissions" value={data.self.submissions} />
              <Stat label="Completed" value={data.self.completed} />
              <Stat label="Conversion" value={`${data.self.conversionRate}%`} />
            </div>
          </section>

          {data.downline.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-xl font-semibold text-ink">Your team</h2>
              <p className="mb-4 text-sm text-slate">
                Everyone below you in the reporting chain. Copy their link to share it on their behalf.
              </p>
              <div className="overflow-hidden rounded-card border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Submissions</th>
                      <th className="px-4 py-3">Completed</th>
                      <th className="px-4 py-3">Link</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.downline.map((m) => (
                      <tr key={m.staffId} className="border-t border-line">
                        <td className="px-4 py-3 font-medium text-ink">{m.fullName}</td>
                        <td className="px-4 py-3 text-slate">{m.tier}</td>
                        <td className="px-4 py-3">{m.submissions}</td>
                        <td className="px-4 py-3">{m.completed}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate">{m.link}</td>
                        <td className="px-4 py-3 text-right">
                          {m.link.startsWith("http") && <CopyButton value={m.link} label="Copy" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
    </div>
  );
}
