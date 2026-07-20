"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { FileText, Wallet, CheckCircle2, TrendingUp, Download } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import Skeleton from "@/components/Skeleton";
import { KpiCard, KPI_GRADIENTS } from "@/components/dashboard/KpiCard";
import { BarBreakdown, type Count } from "@/components/dashboard/BarBreakdown";
import { DonutLegendCard } from "@/components/dashboard/DonutLegendCard";
import { TimeSeriesAreaCard } from "@/components/dashboard/TimeSeriesAreaCard";
import { ROLE_CONFIGS, ROLE_ORDER } from "@/lib/staffRoles";
import { getGrantCategory } from "@/lib/grantCategories";
import { initials } from "@/lib/initials";
import type { ApplicationRecord, StaffRecord, VisitRecord, PayoutSettingsRecord } from "@/lib/types";

const CANONICAL_TIERS = ROLE_ORDER.map((r) => ROLE_CONFIGS[r].tier);

export default function DashboardPage() {
  return (
    <AdminGate>
      <AdminShell>
        <Dashboard />
      </AdminShell>
    </AdminGate>
  );
}

function countBy(apps: ApplicationRecord[], key: keyof ApplicationRecord): Count[] {
  const counts = new Map<string, number>();
  for (const a of apps) {
    const v = a[key];
    if (typeof v === "string" && v.trim()) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function Dashboard() {
  const [apps, setApps] = useState<ApplicationRecord[] | null>(null);
  const [staffById, setStaffById] = useState<Map<string, StaffRecord>>(new Map());
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [payoutRate, setPayoutRate] = useState(0);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const db = getFirebaseDb();
        const [appsSnap, staffSnap, visitsSnap, settingsSnap] = await Promise.all([
          getDocs(collection(db, "applications")),
          getDocs(collection(db, "staff")),
          getDocs(collection(db, "visits")),
          getDoc(doc(db, "payoutSettings", "rate")),
        ]);
        setApps(appsSnap.docs.map((d) => d.data() as ApplicationRecord).filter((a) => !a.isTest));
        const map = new Map<string, StaffRecord>();
        staffSnap.forEach((d) => {
          const s = d.data() as StaffRecord;
          map.set(s.staffId, s);
        });
        setStaffById(map);
        setVisits(visitsSnap.docs.map((d) => d.data() as VisitRecord).filter((v) => !v.isTest));
        if (settingsSnap.exists()) {
          setPayoutRate((settingsSnap.data() as PayoutSettingsRecord).perCompletionAmount);
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message.includes("permission")
            ? "Access denied. Your account isn't in the admins collection yet, or the Firestore rules haven't been published — see the README."
            : "Couldn't load dashboard data. Please try refreshing.";
        setError(message);
        console.error("Failed to load dashboard:", err);
      }
    }
    load();
  }, []);

  const kpis = useMemo(() => {
    if (!apps) return null;
    const completed = apps.filter((a) => a.status === "phase2_marked_complete").length;
    return {
      totalApplications: apps.length,
      expectedPayout: completed * payoutRate,
      completedCount: completed,
      completionRate: apps.length ? Math.round((completed / apps.length) * 100) : 0,
      totalStaff: staffById.size,
      totalVisits: visits.length,
      conversionRate: visits.length ? Math.round((apps.length / visits.length) * 100) : 0,
    };
  }, [apps, staffById, visits, payoutRate]);

  const timeSeries = useMemo(() => {
    if (!apps) return [];
    const counts = new Map<string, number>();
    for (const a of apps) {
      if (!a.createdAt) continue;
      const day = a.createdAt.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([date, count]) => ({ date: date.slice(5), count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [apps]);

  const leaderboard = useMemo(() => {
    if (!apps) return [];
    const counts = new Map<string, { submissions: number; completed: number; visits: number }>();
    for (const a of apps) {
      const key = a.referredBy || "unassigned";
      const entry = counts.get(key) ?? { submissions: 0, completed: 0, visits: 0 };
      entry.submissions += 1;
      if (a.status === "phase2_marked_complete") entry.completed += 1;
      counts.set(key, entry);
    }
    for (const v of visits) {
      const key = v.staffId || "unassigned";
      const entry = counts.get(key) ?? { submissions: 0, completed: 0, visits: 0 };
      entry.visits += 1;
      counts.set(key, entry);
    }
    let rows = Array.from(counts.entries()).map(([staffId, c]) => {
      const staff = staffById.get(staffId);
      return {
        staffId,
        name: staff?.fullName ?? (staffId === "unassigned" ? "Unassigned" : staffId),
        tier: staff?.tier ?? "—",
        visits: c.visits,
        submissions: c.submissions,
        completed: c.completed,
        conversionRate: c.visits ? Math.round((c.submissions / c.visits) * 100) : c.submissions ? 100 : 0,
      };
    });
    if (tierFilter !== "all") rows = rows.filter((r) => r.tier === tierFilter);
    rows.sort((a, b) => b.submissions - a.submissions);
    return rows;
  }, [apps, staffById, visits, tierFilter]);

  const breakdowns = useMemo(() => {
    if (!apps) return null;
    const categoryNames = apps.map((a) => (a.grantCategory ? getGrantCategory(a.grantCategory).name : "")).filter(Boolean);
    const categoryCounts = new Map<string, number>();
    for (const name of categoryNames) categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
    const grantCategory = Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const tierCounts = new Map<string, number>();
    for (const a of apps) {
      if (!a.grantCategory) continue;
      const tier = getGrantCategory(a.grantCategory).tier;
      const label = tier === "trader" ? "Street/market/shop trader" : tier === "enterprise" ? "Registered Business Name" : "Registered LLC";
      tierCounts.set(label, (tierCounts.get(label) ?? 0) + 1);
    }
    const tierSplit = Array.from(tierCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      grantCategory,
      tierSplit,
      states: countBy(apps, "stateOfResidence").slice(0, 8),
      businessType: countBy(apps, "businessType").slice(0, 8),
    };
  }, [apps]);

  function exportCsv() {
    if (!apps) return;
    const headers = [
      "applicationId", "applicantName", "phone", "email", "stateOfResidence", "businessName",
      "grantCategory", "grantAmount", "grantNeedExplanation", "businessType", "businessLocation",
      "monthlyProductCost", "cacNumber", "businessDescription",
      "referredBy", "grantCode", "status", "createdAt",
    ];
    const lines = [
      headers.join(","),
      ...apps.map((a) =>
        headers
          .map((h) => {
            const raw = (a as unknown as Record<string, unknown>)[h];
            const cell = Array.isArray(raw) ? raw.join("; ") : (raw ?? "");
            return `"${String(cell).replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tiers = useMemo(() => {
    const present = new Set<string>();
    staffById.forEach((s) => {
      if (s.tier && s.tier.trim()) present.add(s.tier.trim());
    });
    const extra = Array.from(present)
      .filter((t) => !(CANONICAL_TIERS as string[]).includes(t))
      .sort();
    return ["all", ...CANONICAL_TIERS, ...extra];
  }, [staffById]);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-gold">Admin · Analytics</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">Overview</h1>
          <p className="mt-1 text-sm text-slate">
            {kpis ? `${kpis.totalStaff} staff synced · ${kpis.totalVisits.toLocaleString()} link visits tracked` : "Referral performance and application insights."}
          </p>
        </div>
        <button onClick={exportCsv} className="btn-secondary flex items-center gap-2">
          <Download size={15} />
          Export CSV
        </button>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {!apps && !error && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="mt-4 h-7 w-24" />
              <Skeleton className="mt-2 h-3.5 w-20" />
            </div>
          ))}
        </div>
      )}

      {kpis && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            index={0}
            icon={FileText}
            gradient={KPI_GRADIENTS[0]}
            label="Applications"
            numericValue={kpis.totalApplications}
          />
          <KpiCard
            index={1}
            icon={Wallet}
            gradient={KPI_GRADIENTS[1]}
            label="Expected payout"
            prefix="₦"
            numericValue={kpis.expectedPayout}
            sub={`${kpis.completedCount} completed × ₦${payoutRate.toLocaleString()}`}
          />
          <KpiCard
            index={2}
            icon={CheckCircle2}
            gradient={KPI_GRADIENTS[2]}
            label="Phase 2 complete"
            numericValue={kpis.completionRate}
            suffix="%"
          />
          <KpiCard
            index={3}
            icon={TrendingUp}
            gradient={KPI_GRADIENTS[3]}
            label="Visit → submit"
            numericValue={kpis.conversionRate}
            suffix="%"
          />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2" style={{ "--delay": "280ms" } as CSSProperties}>
          <TimeSeriesAreaCard title="Applications over time" data={timeSeries} />
        </div>

        <div className="card-rise lift-hover" style={{ "--delay": "340ms" } as CSSProperties}>
          <DonutLegendCard title="Grant category" data={breakdowns?.grantCategory ?? []} />
        </div>
      </div>

      <div className="card-rise mb-6 overflow-hidden rounded-2xl border border-line bg-white shadow-sm" style={{ "--delay": "400ms" } as CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="font-display text-base font-semibold text-ink">Referral leaderboard</h2>
          <select className="input max-w-xs" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
            {tiers.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All tiers" : t}
              </option>
            ))}
          </select>
        </div>

        {leaderboard.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate">No referral activity yet.</p>
        ) : (
          <>
            <div className="hidden items-center gap-4 px-6 pt-4 text-xs uppercase tracking-wide text-slate sm:flex">
              <span className="w-9" />
              <span className="min-w-0 flex-1">Staff</span>
              <span className="hidden w-32 text-right sm:block">Conversion</span>
              <span className="w-16 text-right">Visits</span>
              <span className="w-20 text-right">Submitted</span>
              <span className="w-20 text-right">Phase 2</span>
            </div>
            <div className="divide-y divide-line">
              {leaderboard.map((r, i) => (
                <div
                  key={r.staffId}
                  className="row-rise flex items-center gap-4 px-6 py-3.5 transition-colors duration-150 hover:bg-paper"
                  style={{ "--delay": `${Math.min(i, 10) * 45}ms` } as CSSProperties}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold text-white shadow-sm"
                    style={{ background: KPI_GRADIENTS[i % KPI_GRADIENTS.length] }}
                  >
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                    <p className="text-xs text-slate">{r.tier}</p>
                  </div>
                  <div className="hidden w-32 items-center gap-2 sm:flex">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                      <div
                        className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{
                          width: `${Math.min(100, r.conversionRate)}%`,
                          transitionDelay: `${Math.min(i, 10) * 45}ms`,
                          background: "linear-gradient(90deg, #0E7A3A, #C8952A)",
                        }}
                      />
                    </div>
                    <span className="w-9 text-right text-xs text-slate">{r.conversionRate}%</span>
                  </div>
                  <div className="w-16 text-right text-sm text-slate">{r.visits || "—"}</div>
                  <div className="w-20 text-right text-sm font-medium text-ink">{r.submissions}</div>
                  <div className="w-20 text-right text-sm text-slate">{r.completed}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {!apps && !error && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="border-b border-line px-6 py-4">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="divide-y divide-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-3.5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="mt-1.5 h-3 w-20" />
                </div>
                <Skeleton className="hidden h-1.5 w-32 sm:block" />
              </div>
            ))}
          </div>
        </div>
      )}

      {breakdowns && (
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Applicant response breakdown</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="card-rise lift-hover" style={{ "--delay": "460ms" } as CSSProperties}>
              <BarBreakdown title="Applications by grant category" data={breakdowns.grantCategory} />
            </div>
            <div className="card-rise lift-hover" style={{ "--delay": "500ms" } as CSSProperties}>
              <BarBreakdown title="Top states" data={breakdowns.states} />
            </div>
            <div className="card-rise lift-hover" style={{ "--delay": "540ms" } as CSSProperties}>
              <DonutLegendCard title="Applicant type" data={breakdowns.tierSplit} />
            </div>
            <div className="card-rise lift-hover" style={{ "--delay": "580ms" } as CSSProperties}>
              <BarBreakdown title="Top business types (traders)" data={breakdowns.businessType} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
