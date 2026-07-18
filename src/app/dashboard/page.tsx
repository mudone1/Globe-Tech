"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import StaffGate from "@/components/StaffGate";
import BrandMark from "@/components/BrandMark";
import CopyButton from "@/components/CopyButton";
import CountUp from "@/components/CountUp";
import Skeleton from "@/components/Skeleton";
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

      {!data && !error && (
        <div className="card-rise rounded-card border border-line bg-white p-6 shadow-sm">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-24" />
          <Skeleton className="mt-4 h-12 w-full" />
          <div className="mt-6 grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="mx-auto h-7 w-14" />
                <Skeleton className="mx-auto mt-2 h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          <section className="card-rise lift-hover rounded-card border border-line bg-white p-6 shadow-sm">
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
              <Stat label="Submissions" value={data.self.submissions} delay={80} />
              <Stat label="Completed" value={data.self.completed} delay={140} />
              <Stat label="Conversion" value={data.self.conversionRate} suffix="%" delay={200} />
            </div>
          </section>

          {data.downline.length > 0 && (
            <section className="card-rise mt-8" style={{ "--delay": "160ms" } as CSSProperties}>
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
                    {data.downline.map((m, i) => (
                      <tr
                        key={m.staffId}
                        className="row-rise border-t border-line transition-colors duration-150 hover:bg-paper"
                        style={{ "--delay": `${Math.min(i, 12) * 40}ms` } as CSSProperties}
                      >
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

          {data.applicants.length > 0 && (
            <section className="card-rise mt-8" style={{ "--delay": "220ms" } as CSSProperties}>
              <h2 className="mb-3 font-display text-xl font-semibold text-ink">Your applicants</h2>
              <p className="mb-4 text-sm text-slate">
                Everyone who applied through your link (or your team's). Account details stay
                private — you only see verification progress.
              </p>
              <div className="overflow-hidden rounded-card border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
                    <tr>
                      <th className="px-4 py-3">Applicant</th>
                      <th className="px-4 py-3">Business</th>
                      <th className="px-4 py-3">Grant category</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.applicants.map((a, i) => (
                      <tr
                        key={a.applicationId}
                        className="row-rise border-t border-line transition-colors duration-150 hover:bg-paper"
                        style={{ "--delay": `${Math.min(i, 12) * 40}ms` } as CSSProperties}
                      >
                        <td className="px-4 py-3 font-medium text-ink">{a.applicantName}</td>
                        <td className="px-4 py-3 text-slate">{a.businessName}</td>
                        <td className="px-4 py-3 text-slate">{a.grantCategoryName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              a.statusLabel === "Completed" ? "bg-brand/10 text-brand" : "bg-goldSoft text-ink"
                            }`}
                          >
                            {a.statusLabel}
                          </span>
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

function Stat({ label, value, suffix = "", delay = 0 }: { label: string; value: string | number; suffix?: string; delay?: number }) {
  return (
    <div className="pop-in" style={{ "--delay": `${delay}ms` } as CSSProperties}>
      <p className="font-display text-2xl font-semibold text-ink">
        {typeof value === "number" ? (
          <>
            <CountUp value={value} />
            {suffix}
          </>
        ) : (
          value
        )}
      </p>
      <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
    </div>
  );
}
