"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { FileText, CheckCircle2, TrendingUp, PhoneCall } from "lucide-react";
import StaffGate from "@/components/StaffGate";
import BrandMark from "@/components/BrandMark";
import CopyButton from "@/components/CopyButton";
import Skeleton from "@/components/Skeleton";
import HierarchyTree from "@/components/HierarchyTree";
import { buildHierarchyForest, sumSubtree, type HierarchyNode } from "@/lib/staffHierarchy";
import { KpiCard, KPI_GRADIENTS } from "@/components/dashboard/KpiCard";
import { DonutLegendCard } from "@/components/dashboard/DonutLegendCard";
import { TimeSeriesAreaCard } from "@/components/dashboard/TimeSeriesAreaCard";
import { initials } from "@/lib/initials";
import { getMyDashboardData, type DashboardData, type DashboardMember, type DashboardError } from "@/app/dashboard/actions";

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
  const [hasCrmAccess, setHasCrmAccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const result: DashboardData | DashboardError = await getMyDashboardData(session.access_token);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setData(result);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        setError("Couldn't load your dashboard. Please try refreshing.");
      }

      // CRM access check — same admin-or-crm_access logic as CrmGate, so the
      // link only appears for staff who'd actually be let in.
      try {
        const uid = session.user.id;
        const [{ data: adminRow }, { data: crmRow }] = await Promise.all([
          supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle(),
          supabase.from("crm_access").select("user_id").eq("user_id", uid).maybeSingle(),
        ]);
        setHasCrmAccess(Boolean(adminRow || crmRow));
      } catch (err) {
        console.error("Failed to check CRM access:", err);
      }
    }
    load();
  }, []);

  async function handleSignOut() {
    await getSupabaseClient().auth.signOut();
    router.push("/admin/login");
  }

  const teamForest = useMemo(() => {
    if (!data) return [];
    const rootIds = new Set(
      data.downline.filter((m) => m.reportsToCode === data.self.staffId).map((m) => m.staffId)
    );
    return buildHierarchyForest(data.downline, rootIds);
  }, [data]);

  function renderTeamRow(node: HierarchyNode<DashboardMember>, depth: number) {
    const m = node.staff;
    const hasChildren = node.children.length > 0;
    const rollupSubmissions = hasChildren ? sumSubtree(node, (s) => s.submissions) : m.submissions;
    const rollupCompleted = hasChildren ? sumSubtree(node, (s) => s.completed) : m.completed;
    const rollupConversion = rollupSubmissions ? Math.round((rollupCompleted / rollupSubmissions) * 100) : 0;

    return (
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold text-white shadow-sm"
          style={{ background: KPI_GRADIENTS[depth % KPI_GRADIENTS.length] }}
        >
          {initials(m.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{m.fullName}</p>
          <p className="text-xs text-slate">{m.tier}</p>
        </div>
        <div className="hidden w-24 text-right text-xs text-slate sm:block">
          {m.registeredAt ? new Date(m.registeredAt).toLocaleDateString("en-GB", { year: "2-digit", month: "short", day: "numeric" }) : "—"}
        </div>
        <div className="hidden w-32 items-center gap-2 sm:flex">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.min(100, m.conversionRate)}%`,
                background: "linear-gradient(90deg, #0E7A3A, #C8952A)",
              }}
            />
          </div>
          <span className="w-9 text-right text-xs text-slate">{m.conversionRate}%</span>
        </div>
        <div className="w-20 text-right text-sm font-medium text-ink">{m.submissions}</div>
        <div className="w-20 text-right text-sm text-slate">{m.completed}</div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-32">
          {m.link.startsWith("http") ? <CopyButton value={m.link} label="Copy" /> : <span className="text-right text-xs text-slate">Paused</span>}
        </div>
        {hasChildren && (
          <p className="w-full text-xs font-medium text-brand">
            + {node.children.length} under them: {rollupSubmissions} submissions, {rollupCompleted} completed, {rollupConversion}% conversion
          </p>
        )}
      </div>
    );
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
          {data && (
            <p className="mt-1 font-mono text-xs text-slate">
              Staff ID: <span className="font-semibold text-ink">{data.self.staffId}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasCrmAccess && (
            <Link href="/crm" className="btn-secondary flex items-center gap-1.5 text-sm">
              <PhoneCall size={15} strokeWidth={2} />
              CRM
            </Link>
          )}
          <button onClick={handleSignOut} className="btn-secondary text-sm">
            Sign out
          </button>
        </div>
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
                <span className="hidden w-24 text-right sm:block">Joined</span>
                <span className="hidden w-32 text-right sm:block">Conversion</span>
                <span className="w-20 text-right">Submitted</span>
                <span className="w-20 text-right">Completed</span>
                <span className="w-32 text-right">Link</span>
              </div>
              <HierarchyTree nodes={teamForest} renderRow={renderTeamRow} getKey={(s) => s.staffId} />
            </section>
          )}

          {data.staffDetails.length > 0 && (
            <section
              className="card-rise mb-6 overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
              style={{ "--delay": "430ms" } as CSSProperties}
            >
              <div className="border-b border-line px-6 py-4">
                <h2 className="font-display text-base font-semibold text-ink">Staff details</h2>
                <p className="mt-1 text-sm text-slate">
                  {data.self.tier === "Regional Coordinator"
                    ? "Staff ID, state, phone number, and address for everyone in your reporting chain."
                    : "Staff ID, state, phone number, and address for the Marketing Officers under you."}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
                    <tr>
                      <th className="px-6 py-3">Staff</th>
                      <th className="px-6 py-3">Staff ID</th>
                      <th className="px-6 py-3">State</th>
                      <th className="px-6 py-3">Phone</th>
                      <th className="px-6 py-3">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staffDetails.map((s, i) => (
                      <tr
                        key={s.staffId}
                        className="row-rise border-t border-line transition-colors duration-150 hover:bg-paper"
                        style={{ "--delay": `${Math.min(i, 12) * 40}ms` } as CSSProperties}
                      >
                        <td className="px-6 py-3">
                          <p className="font-medium text-ink">{s.fullName}</p>
                          <p className="text-xs text-slate">{s.tier}</p>
                        </td>
                        <td className="px-6 py-3 font-mono text-xs text-ink">{s.staffId}</td>
                        <td className="px-6 py-3 text-slate">{s.state}</td>
                        <td className="px-6 py-3 text-slate">{s.phone}</td>
                        <td className="px-6 py-3 text-slate">{s.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  Everyone who applied through your link (or your team's) — with their phone number, so
                  follow-up is one tap away. Account details stay private; you only see verification progress.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
                    <tr>
                      <th className="px-6 py-3">Applicant</th>
                      <th className="px-6 py-3">Phone</th>
                      <th className="px-6 py-3">Business</th>
                      <th className="px-6 py-3">Grant category</th>
                      {data.downline.length > 0 && <th className="px-6 py-3">Referred by</th>}
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
                        <td className="px-6 py-3">
                          {a.phone ? (
                            <a href={`tel:${a.phone}`} className="font-mono text-xs text-brand hover:underline">
                              {a.phone}
                            </a>
                          ) : (
                            <span className="text-slate">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate">{a.businessName}</td>
                        <td className="px-6 py-3 text-slate">{a.grantCategoryName}</td>
                        {data.downline.length > 0 && (
                          <td className="px-6 py-3 text-slate">{a.referredByName}</td>
                        )}
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
