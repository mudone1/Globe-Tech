"use client";

import { useEffect, useMemo, useState, use as usePromise, type CSSProperties } from "react";
import Link from "next/link";
import { getTableCached } from "@/lib/supabaseCache";
import { rowToStaffRecord, rowToApplicationRecord, rowToLinkToken } from "@/lib/supabaseMappers";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import CopyButton from "@/components/CopyButton";
import Skeleton from "@/components/Skeleton";
import HierarchyTree from "@/components/HierarchyTree";
import { buildHierarchyForest, getDownlineFromList, type HierarchyNode } from "@/lib/staffHierarchy";
import { applicationStatusLabel } from "@/lib/phase2Status";
import { getGrantCategory } from "@/lib/grantCategories";
import type { StaffRecord, ApplicationRecord } from "@/lib/types";

export default function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  return (
    <AdminGate>
      <AdminShell>
        <StaffProfile staffId={decodeURIComponent(id)} />
      </AdminShell>
    </AdminGate>
  );
}

function StatCard({ label, value, sub, delay }: { label: string; value: string | number; sub?: string; delay: number }) {
  return (
    <div
      className="card-rise lift-hover rounded-2xl border border-line bg-white p-5 shadow-sm"
      style={{ "--delay": `${delay}ms` } as CSSProperties}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate">{sub}</p>}
    </div>
  );
}

function StaffProfile({ staffId }: { staffId: string }) {
  const [allStaff, setAllStaff] = useState<StaffRecord[] | null>(null);
  const [allApps, setAllApps] = useState<ApplicationRecord[] | null>(null);
  const [linkByStaffId, setLinkByStaffId] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [staffData, appsData, tokensData] = await Promise.all([
          getTableCached("staff", rowToStaffRecord),
          getTableCached("applications", rowToApplicationRecord),
          getTableCached("link_tokens", rowToLinkToken),
        ]);
        setAllStaff(staffData);
        setAllApps(appsData);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        const map = new Map<string, string>();
        for (const t of tokensData) map.set(t.staffId, `${appUrl}/apply/${t.token}`);
        setLinkByStaffId(map);
      } catch (err) {
        setError("Couldn't load staff data. Please try refreshing.");
        console.error("Failed to load staff profile data:", err);
      }
    }
    load();
  }, []);

  const me = useMemo(() => allStaff?.find((s) => s.staffId === staffId) ?? null, [allStaff, staffId]);

  const downline = useMemo(() => {
    if (!allStaff) return [];
    return getDownlineFromList(staffId, allStaff);
  }, [allStaff, staffId]);

  const downlineIds = useMemo(() => new Set(downline.map((s) => s.staffId)), [downline]);

  const directApps = useMemo(() => (allApps ?? []).filter((a) => a.referredBy === staffId), [allApps, staffId]);
  const downlineApps = useMemo(
    () => (allApps ?? []).filter((a) => downlineIds.has(a.referredBy)),
    [allApps, downlineIds]
  );
  const teamApps = useMemo(() => [...directApps, ...downlineApps], [directApps, downlineApps]);

  const completedCount = teamApps.filter((a) => a.status === "phase2_marked_complete").length;
  const conversionRate = teamApps.length ? Math.round((completedCount / teamApps.length) * 100) : 0;

  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of teamApps) {
      const label = applicationStatusLabel(a);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [teamApps]);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allStaff ?? []) map.set(s.staffId, s.fullName);
    return map;
  }, [allStaff]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamApps;
    return teamApps.filter(
      (a) =>
        a.applicantName?.toLowerCase().includes(q) ||
        a.businessName?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q)
    );
  }, [teamApps, search]);

  const downlineForest = useMemo(() => buildHierarchyForest(downline), [downline]);

  function renderDownlineRow(node: HierarchyNode<StaffRecord>) {
    const s = node.staff;
    const own = (allApps ?? []).filter((a) => a.referredBy === s.staffId).length;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/admin/staff/${encodeURIComponent(s.staffId)}`} className="font-medium text-ink hover:text-brand hover:underline">
            {s.fullName}
          </Link>
          <p className="text-xs text-slate">{s.tier}</p>
        </div>
        <span className="text-sm text-slate">{own} referred</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>
      </div>
    );
  }

  if (!allStaff || !allApps) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-slate">No staff member found for that ID.</p>
        <Link href="/admin/staff" className="mt-2 inline-block text-sm text-brand hover:underline">
          ← Back to staff
        </Link>
      </div>
    );
  }

  const link = linkByStaffId.get(staffId);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/staff" className="text-sm text-slate hover:text-ink hover:underline">
        ← Back to staff
      </Link>

      <header className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-gold">{me.tier}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{me.fullName}</h1>
          <p className="mt-1 font-mono text-xs text-slate">{me.staffId}</p>
          {me.reportsToName && <p className="mt-1 text-xs text-slate">Reports to: {me.reportsToName}</p>}
        </div>
        {link && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate">{link}</span>
            <CopyButton value={link} label="Copy link" />
          </div>
        )}
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard delay={0} label="Total referred" value={teamApps.length} sub={`${directApps.length} direct · ${downlineApps.length} downline`} />
        <StatCard delay={60} label="Direct referrals" value={directApps.length} />
        <StatCard delay={120} label="Downline referrals" value={downlineApps.length} sub={`${downline.length} team member${downline.length === 1 ? "" : "s"}`} />
        <StatCard delay={180} label="Conversion" value={`${conversionRate}%`} sub={`${completedCount} completed`} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div
          className="card-rise lift-hover rounded-2xl border border-line bg-white p-5 shadow-sm"
          style={{ "--delay": "240ms" } as CSSProperties}
        >
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">Status breakdown</h2>
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-slate">No applications yet.</p>
          ) : (
            <div className="space-y-2">
              {statusBreakdown.map(([label, count]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-slate">{label}</span>
                  <span className="font-medium text-ink">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="card-rise lift-hover rounded-2xl border border-line bg-white p-5 shadow-sm"
          style={{ "--delay": "300ms" } as CSSProperties}
        >
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">
            Downline {downline.length > 0 && `(${downline.length})`}
          </h2>
          {downlineForest.length === 0 ? (
            <p className="text-sm text-slate">No downline — this staff member has no one reporting to them.</p>
          ) : (
            <div className="-mx-5 -mb-5 divide-y divide-line border-t border-line">
              <div className="px-5 py-3">
                <HierarchyTree nodes={downlineForest} renderRow={renderDownlineRow} getKey={(s) => s.staffId} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink">
          Referred applicants ({teamApps.length})
        </h2>
        <input
          className="input max-w-xs"
          placeholder="Search name, business, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div
        className="card-rise overflow-hidden rounded-card border border-line bg-white"
        style={{ "--delay": "360ms" } as CSSProperties}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Grant category</th>
                <th className="px-4 py-3">Status</th>
                {downline.length > 0 && <th className="px-4 py-3">Referred by</th>}
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate">
                    {teamApps.length === 0 ? "No applicants referred yet." : `No applicants match "${search}".`}
                  </td>
                </tr>
              )}
              {filteredApps.map((a, i) => (
                <tr
                  key={a.applicationId}
                  className="row-rise border-t border-line transition-colors duration-150 hover:bg-paper"
                  style={{ "--delay": `${Math.min(i, 14) * 35}ms` } as CSSProperties}
                >
                  <td className="px-4 py-3">
                    <Link href={`/admin/applications/${a.applicationId}`} className="font-medium text-ink hover:text-brand hover:underline">
                      {a.applicantName || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {a.phone ? (
                      <a href={`tel:${a.phone}`} className="font-mono text-xs text-brand hover:underline">
                        {a.phone}
                      </a>
                    ) : (
                      <span className="text-slate">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate">{a.businessName || "—"}</td>
                  <td className="px-4 py-3 text-slate">{a.grantCategory ? getGrantCategory(a.grantCategory).name : "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        a.status === "phase2_marked_complete" ? "bg-brand/10 text-brand" : "bg-goldSoft text-ink"
                      }`}
                    >
                      {applicationStatusLabel(a)}
                    </span>
                  </td>
                  {downline.length > 0 && (
                    <td className="px-4 py-3 text-slate">{staffNameById.get(a.referredBy) ?? a.referredBy}</td>
                  )}
                  <td className="px-4 py-3 text-slate">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
