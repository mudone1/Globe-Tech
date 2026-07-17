"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { FileText, Wallet, CheckCircle2, TrendingUp, Download, type LucideIcon } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import CountUp from "@/components/CountUp";
import Skeleton from "@/components/Skeleton";
import { ROLE_CONFIGS, ROLE_ORDER } from "@/lib/staffRoles";
import { getGrantCategory } from "@/lib/grantCategories";
import type { ApplicationRecord, StaffRecord, VisitRecord, PayoutSettingsRecord } from "@/lib/types";

const CANONICAL_TIERS = ROLE_ORDER.map((r) => ROLE_CONFIGS[r].tier);

const CHART_COLORS = ["#0E7A3A", "#C8952A", "#2BB894", "#D98A4C", "#054A26", "#7FA688", "#B3392C", "#4B5B52"];

const KPI_GRADIENTS = [
  "linear-gradient(135deg, #17B25C 0%, #075C31 100%)", // emerald
  "linear-gradient(135deg, #EBBD52 0%, #B3791E 100%)", // gold
  "linear-gradient(135deg, #2FC7A3 0%, #0E6B54 100%)", // teal
  "linear-gradient(135deg, #E0965A 0%, #954E1F 100%)", // bronze/terracotta
];

export default function DashboardPage() {
  return (
    <AdminGate>
      <AdminShell>
        <Dashboard />
      </AdminShell>
    </AdminGate>
  );
}

interface Count {
  name: string;
  count: number;
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
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
        setApps(appsSnap.docs.map((d) => d.data() as ApplicationRecord));
        const map = new Map<string, StaffRecord>();
        staffSnap.forEach((d) => {
          const s = d.data() as StaffRecord;
          map.set(s.staffId, s);
        });
        setStaffById(map);
        setVisits(visitsSnap.docs.map((d) => d.data() as VisitRecord));
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
      "monthlyProductCost", "cacNumber", "cacDocumentUrl", "businessDescription",
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
        <div className="card-rise lift-hover rounded-2xl border border-line bg-white p-6 shadow-sm xl:col-span-2" style={{ "--delay": "280ms" } as CSSProperties}>
          <h2 className="mb-4 font-display text-base font-semibold text-ink">Applications over time</h2>
          {timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="appFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#17B25C" stopOpacity={0.45} />
                    <stop offset="60%" stopColor="#17B25C" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#17B25C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="appStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0E7A3A" />
                    <stop offset="100%" stopColor="#C8952A" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE6DE" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#4B5B52" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#4B5B52" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Applications"
                  stroke="url(#appStroke)"
                  strokeWidth={3}
                  fill="url(#appFill)"
                  isAnimationActive
                  animationDuration={1100}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate">No applications yet.</p>
          )}
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

function KpiCard({
  icon: Icon,
  gradient,
  label,
  prefix = "",
  numericValue,
  suffix = "",
  sub,
  index = 0,
}: {
  icon: LucideIcon;
  gradient: string;
  label: string;
  prefix?: string;
  numericValue: number;
  suffix?: string;
  sub?: string;
  index?: number;
}) {
  return (
    <div
      className="card-rise lift-hover relative overflow-hidden rounded-2xl p-5 shadow-lg"
      style={{ "--delay": `${index * 70}ms`, background: gradient } as CSSProperties}
    >
      {/* Soft light-source glow, top-left — echoes the reference's vivid gradient cards */}
      <div
        className="pointer-events-none absolute -left-6 -top-10 h-32 w-32 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.55), transparent 70%)" }}
      />
      <div
        className="pop-in relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm"
        style={{ "--delay": `${index * 70 + 120}ms` } as CSSProperties}
      >
        <Icon size={18} className="text-white" strokeWidth={2.25} />
      </div>
      <p className="relative mt-4 font-display text-2xl font-semibold text-white">
        {prefix}
        <CountUp value={numericValue} />
        {suffix}
      </p>
      <p className="relative mt-0.5 text-sm text-white/80">{label}</p>
      {sub && <p className="relative mt-1.5 text-xs text-white/60">{sub}</p>}
    </div>
  );
}

function BarBreakdown({ title, data }: { title: string; data: Count[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h3 className="mb-3 font-display text-base font-semibold text-ink">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-slate">No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <defs>
              <linearGradient id="barFill" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0E7A3A" />
                <stop offset="100%" stopColor="#2FC7A3" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#DCE6DE" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#4B5B52" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 11, fill: "#0B2A18" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)}
            />
            <Tooltip />
            <Bar dataKey="count" name="Applications" fill="url(#barFill)" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function DonutLegendCard({ title, data }: { title: string; data: Count[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      <p className="mb-2 text-xs text-slate">{total ? `${total} response${total === 1 ? "" : "s"}` : "No data yet"}</p>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate">No data yet.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                innerRadius={54}
                outerRadius={78}
                paddingAngle={3}
                stroke="none"
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-3 space-y-2">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className="shrink-0 text-slate">{total ? Math.round((d.count / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
