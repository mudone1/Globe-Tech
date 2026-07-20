"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { FileText, CheckCircle2, TrendingUp } from "lucide-react";
import StaffGate from "@/components/StaffGate";
import BrandMark from "@/components/BrandMark";
import CopyButton from "@/components/CopyButton";
import Skeleton from "@/components/Skeleton";
import { KpiCard, KPI_GRADIENTS } from "@/components/dashboard/KpiCard";
import { DonutLegendCard } from "@/components/dashboard/DonutLegendCard";
import { TimeSeriesAreaCard } from "@/components/dashboard/TimeSeriesAreaCard";
import { initials } from "@/lib/initials";
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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <BrandMark size="sm" href="/dashboard" />
          <p className="mt-3 font-mono text-xs uppercase tracking-widest text-gold">
            {data ? `${data.self.tier} · Your Dashboard` : "Your Dashboard"}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">
            {data ? data.self.fullName : "Welcome back"}
          </h1>
        </div>
        <button onClick={handleSignOut} className="btn-secondary text-sm">
          Sign out
        </button>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {!data && !error && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="mt-4 h-7 w-24" />
                <Skeleton className="mt-2 h-3.5 w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-4 h-12 w-full" />
          </div>
        </>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              index={0}
              icon={FileText}
              gradient={KPI_GRADIENTS[0]}
              label="Submissions"
              numericValue={data.teamStats.totalSubmissions}
              sub={data.downline.length > 0 ? "You + your team" : undefined}
            />
            <KpiCard
              index={1}
              icon={CheckCircle2}
              gradient={KPI_GRADIENTS[2]}
              label="Completed"
              numericValue={data.teamStats.totalCompleted}
            />
            <KpiCard
              index={2}
              icon={TrendingUp}
              gradient={KPI_GRADIENTS[3]}
              label="Conversion"
              numericValue={data.teamStats.conversionRate}
              suffix="%"
            />
          </div>

          <section
            className="card-rise lift-hover mb-6 rounded-2xl border border-line bg-white p-6 shadow-sm"
            style={{ "--delay": "220ms" } as CSSProperties}
          >
            <p className="font-mono text-xs uppercase tracking-widest text-gold">Your referral link</p>
            {data.self.link.startsWith("http") ? (
              <div className="mt-4 flex items-center gap-3 rounded-md bg-paper px-4 py-3">
                <span className="flex-1 truncate font-mono text-sm text-ink">{data.self.link}</span>
                <CopyButton value={data.self.link} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate">{data.self.link}</p>
            )}
          </section>

          <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2" style={{ "--delay": "280ms" } as CSSProperties}>
              <TimeSeriesAreaCard title="Your applications over time" data={data.timeSeries} />
            </div>
            <div className="card-rise lift-hover" style={{ "--delay": "340ms" } as CSSProperties}>
              <DonutLegendCard title="Grant category" data={data.categoryBreakdown} />
            </div>
          </div>

          {data.downline.length > 0 && (
            <section
              className="card-rise mb-6 overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
              style={{ "--delay": "400ms" } as CSSProperties}
            >
              <div className="border-b border-line px-6 py-4">
                <h2 className="font-display text-base font-semibold text-ink">Your team</h2>
                <p className="mt-1 text-sm text-slate">
                  Everyone below you in the reporting chain. Copy their link to share it on their behalf.
                </p>
              </div>
              <div className="hidden items-center gap-4 px-6 pt-4 text-xs uppercase tracking-wide text-slate sm:flex">
                <span className="w-9" />
                <span className="min-w-0 flex-1">Staff</span>
                <span className="hidden w-32 text-right sm:block">Conversion</span>
                <span className="w-20 text-right">Submitted</span>
                <span className="w-20 text-right">Completed</span>
                <span className="w-32 text-right">Link</span>
              </div>
              <div className="divide-y divide-line">
                {data.downline.map((m, i) => (
                  <div
                    key={m.staffId}
                    className="row-rise flex flex-wrap items-center gap-4 px-6 py-3.5 transition-colors duration-150 hover:bg-paper"
                    style={{ "--delay": `${Math.min(i, 10) * 45}ms` } as CSSProperties}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold text-white shadow-sm"
                      style={{ background: KPI_GRADIENTS[i % KPI_GRADIENTS.length] }}
                    >
                      {initials(m.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{m.fullName}</p>
                      <p className="text-xs text-slate">{m.tier}</p>
                    </div>
                    <div className="hidden w-32 items-center gap-2 sm:flex">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                        <div
                          className="h-full rounded-full transition-[width] duration-700 ease-out"
                          style={{
                            width: `${Math.min(100, m.conversionRate)}%`,
                            transitionDelay: `${Math.min(i, 10) * 45}ms`,
                            background: "linear-gradient(90deg, #0E7A3A, #C8952A)",
                          }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs text-slate">{m.conversionRate}%</span>
                    </div>
                    <div className="w-20 text-right text-sm font-medium text-ink">{m.submissions}</div>
                    <div className="w-20 text-right text-sm text-slate">{m.completed}</div>
                    <div className="flex w-full items-center justify-end gap-2 sm:w-32">
                      {m.link.startsWith("http") ? (
                        <CopyButton value={m.link} label="Copy" />
                      ) : (
                        <span className="text-right text-xs text-slate">Paused</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.applicants.length > 0 && (
            <section
              className="card-rise overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
              style={{ "--delay": "460ms" } as CSSProperties}
            >
              <div className="border-b border-line px-6 py-4">
                <h2 className="font-display text-base font-semibold text-ink">Your applicants</h2>
                <p className="mt-1 text-sm text-slate">
                  Everyone who applied through your link (or your team's). Account details stay
                  private — you only see verification progress.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
                    <tr>
                      <th className="px-6 py-3">Applicant</th>
                      <th className="px-6 py-3">Business</th>
                      <th className="px-6 py-3">Grant category</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.applicants.map((a, i) => (
                      <tr
                        key={a.applicationId}
                        className="row-rise border-t border-line transition-colors duration-150 hover:bg-paper"
                        style={{ "--delay": `${Math.min(i, 12) * 40}ms` } as CSSProperties}
                      >
                        <td className="px-6 py-3 font-medium text-ink">{a.applicantName}</td>
                        <td className="px-6 py-3 text-slate">{a.businessName}</td>
                        <td className="px-6 py-3 text-slate">{a.grantCategoryName}</td>
                        <td className="px-6 py-3">
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
