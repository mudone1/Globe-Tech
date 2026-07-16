"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
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
import type { ApplicationRecord, StaffRecord, VisitRecord } from "@/lib/types";

const CHART_COLORS = ["#0E7A3A", "#C8952A", "#7FA688", "#054A26", "#B3392C", "#4B5B52", "#1E7A4C", "#D7E4D9"];

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

function countByList(apps: ApplicationRecord[], key: keyof ApplicationRecord): Count[] {
  const counts = new Map<string, number>();
  for (const a of apps) {
    const v = a[key];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.trim()) counts.set(item, (counts.get(item) ?? 0) + 1);
      }
    }
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
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const db = getFirebaseDb();
        const [appsSnap, staffSnap, visitsSnap] = await Promise.all([
          getDocs(collection(db, "applications")),
          getDocs(collection(db, "staff")),
          getDocs(collection(db, "visits")),
        ]);
        setApps(appsSnap.docs.map((d) => d.data() as ApplicationRecord));
        const map = new Map<string, StaffRecord>();
        staffSnap.forEach((d) => {
          const s = d.data() as StaffRecord;
          map.set(s.staffId, s);
        });
        setStaffById(map);
        setVisits(visitsSnap.docs.map((d) => d.data() as VisitRecord));
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
    const totalRequested = apps.reduce((sum, a) => sum + (Number(a.grantAmountRequested) || 0), 0);
    const completed = apps.filter((a) => a.status === "phase2_marked_complete").length;
    return {
      totalApplications: apps.length,
      totalRequested,
      avgRequested: apps.length ? Math.round(totalRequested / apps.length) : 0,
      completionRate: apps.length ? Math.round((completed / apps.length) * 100) : 0,
      totalStaff: staffById.size,
      totalVisits: visits.length,
      conversionRate: visits.length ? Math.round((apps.length / visits.length) * 100) : 0,
    };
  }, [apps, staffById, visits]);

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
    return {
      industry: countBy(apps, "industry").slice(0, 8),
      supportCategory: countBy(apps, "supportCategory"),
      businessStage: countBy(apps, "businessStage"),
      gender: countBy(apps, "gender"),
      hasRevenue: countBy(apps, "hasRevenue"),
      states: countBy(apps, "stateOfResidence").slice(0, 8),
      howHeard: countBy(apps, "howHeard"),
      fundingUse: countByList(apps, "fundingUse").slice(0, 8),
    };
  }, [apps]);

  function exportCsv() {
    if (!apps) return;
    const headers = [
      "applicationId", "applicantName", "gender", "dateOfBirth", "phone", "email", "stateOfResidence",
      "lga", "linkedin", "businessSocialHandle", "currentStatus", "hasPriorBusiness",
      "priorBusinessDescription", "businessName", "businessDescription", "industry", "supportCategory",
      "businessStage", "operatingDuration", "dateEstablished", "registrationStatus", "cacNumber",
      "operatingLocation", "employeeCount", "hasRevenue", "avgMonthlyRevenue", "revenueLast12Months",
      "mainCustomers", "customerAcquisitionChannels", "grantAmountRequested", "fundingUse",
      "fundingGrowthExplanation", "biggestChallenge", "whyStartBusiness", "problemSolved", "desiredImpact",
      "fiveYearVision", "jobsToCreate", "whyApplying", "whySelected", "whatMakesDifferent", "appliedBefore",
      "receivedFundingBefore", "priorFundingDetails", "willingAcademy", "willingMentorship",
      "improvementAreas", "howHeard", "entrepreneurNetwork", "referredBy", "status", "createdAt",
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

  const tiers = ["all", "Regional Coordinator", "State Coordinator", "Marketing Officer"];

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
      {!apps && !error && <p className="text-slate">Loading…</p>}

      {kpis && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={FileText}
            iconBg="bg-brand/10"
            iconColor="text-brand"
            label="Applications"
            value={kpis.totalApplications.toLocaleString()}
          />
          <KpiCard
            icon={Wallet}
            iconBg="bg-goldSoft"
            iconColor="text-gold"
            label="Total requested"
            value={`₦${kpis.totalRequested.toLocaleString()}`}
            sub={`avg ₦${kpis.avgRequested.toLocaleString()}`}
          />
          <KpiCard
            icon={CheckCircle2}
            iconBg="bg-good/10"
            iconColor="text-good"
            label="Phase 2 complete"
            value={`${kpis.completionRate}%`}
          />
          <KpiCard
            icon={TrendingUp}
            iconBg="bg-sage/20"
            iconColor="text-brandDark"
            label="Visit → submit"
            value={`${kpis.conversionRate}%`}
          />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="mb-4 font-display text-base font-semibold text-ink">Applications over time</h2>
          {timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="appFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0E7A3A" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0E7A3A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE6DE" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#4B5B52" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#4B5B52" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="Applications" stroke="#0E7A3A" strokeWidth={2.5} fill="url(#appFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate">No applications yet.</p>
          )}
        </div>

        <DonutLegendCard title="Support category" data={breakdowns?.supportCategory ?? []} />
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
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
              {leaderboard.map((r) => (
                <div key={r.staffId} className="flex items-center gap-4 px-6 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-xs font-semibold text-brand">
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                    <p className="text-xs text-slate">{r.tier}</p>
                  </div>
                  <div className="hidden w-32 items-center gap-2 sm:flex">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, r.conversionRate)}%` }} />
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

      {breakdowns && (
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Applicant response breakdown</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <BarBreakdown title="Top industries" data={breakdowns.industry} />
            <BarBreakdown title="Top states" data={breakdowns.states} />
            <BarBreakdown title="Business stage" data={breakdowns.businessStage} />
            <BarBreakdown title="Planned use of funding" data={breakdowns.fundingUse} />
            <DonutLegendCard title="Gender" data={breakdowns.gender} />
            <DonutLegendCard title="Generating revenue?" data={breakdowns.hasRevenue} />
            <BarBreakdown title="How they heard about the program" data={breakdowns.howHeard} className="md:col-span-2" />
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon size={18} className={iconColor} strokeWidth={2.25} />
      </div>
      <p className="mt-4 font-display text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-slate">{label}</p>
      {sub && <p className="mt-1.5 text-xs text-slate/80">{sub}</p>}
    </div>
  );
}

function BarBreakdown({ title, data, className = "" }: { title: string; data: Count[]; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-white p-6 shadow-sm ${className}`}>
      <h3 className="mb-3 font-display text-base font-semibold text-ink">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-slate">No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
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
            <Bar dataKey="count" name="Applications" fill="#0E7A3A" radius={[0, 4, 4, 0]} />
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
              <Pie data={data} dataKey="count" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={3} stroke="none">
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
