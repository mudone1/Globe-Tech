"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import Skeleton from "@/components/Skeleton";
import { getGrantCategory } from "@/lib/grantCategories";
import type { ApplicationRecord, StaffRecord } from "@/lib/types";

const PAGE_SIZE = 25;

export default function ApplicationsPage() {
  return (
    <AdminGate>
      <AdminShell>
        <ApplicationsBrowser />
      </AdminShell>
    </AdminGate>
  );
}

function ApplicationsBrowser() {
  const [apps, setApps] = useState<ApplicationRecord[] | null>(null);
  const [staffById, setStaffById] = useState<Map<string, StaffRecord>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const db = getFirebaseDb();
        const [appsSnap, staffSnap] = await Promise.all([
          getDocs(collection(db, "applications")),
          getDocs(collection(db, "staff")),
        ]);
        const rows = appsSnap.docs
          .map((d) => d.data() as ApplicationRecord)
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setApps(rows);
        const map = new Map<string, StaffRecord>();
        staffSnap.forEach((d) => {
          const s = d.data() as StaffRecord;
          map.set(s.staffId, s);
        });
        setStaffById(map);
      } catch (err) {
        const message =
          err instanceof Error && err.message.includes("permission")
            ? "Access denied. Your account isn't in the admins collection yet, or the Firestore rules haven't been published — see the README."
            : "Couldn't load applications. Please try refreshing.";
        setError(message);
        console.error("Failed to load applications:", err);
      }
    }
    load();
  }, []);

  const categories = useMemo(() => {
    if (!apps) return [];
    return Array.from(new Set(apps.map((a) => a.grantCategory).filter(Boolean))).sort();
  }, [apps]);

  const states = useMemo(() => {
    if (!apps) return [];
    return Array.from(new Set(apps.map((a) => a.stateOfResidence).filter(Boolean))).sort();
  }, [apps]);

  const filtered = useMemo(() => {
    if (!apps) return [];
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (categoryFilter !== "all" && a.grantCategory !== categoryFilter) return false;
      if (stateFilter !== "all" && a.stateOfResidence !== stateFilter) return false;
      if (!q) return true;
      return (
        a.applicantName?.toLowerCase().includes(q) ||
        a.businessName?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q)
      );
    });
  }, [apps, search, statusFilter, categoryFilter, stateFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  const statusLabel: Record<string, string> = {
    phase1_submitted: "Phase 1 submitted",
    phase2_email_sent: "Phase 2 email sent",
    phase2_marked_complete: "Phase 2 complete",
  };

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-gold">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Applications</h1>
          <p className="mt-1 text-sm text-slate">
            {apps ? `${filtered.length} of ${apps.length} application${apps.length === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search name, business, email…"
          value={search}
          onChange={(e) => resetPage(setSearch)(e.target.value)}
        />
        <select
          className="input max-w-[180px]"
          value={statusFilter}
          onChange={(e) => resetPage(setStatusFilter)(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="phase1_submitted">Phase 1 submitted</option>
          <option value="phase2_email_sent">Phase 2 email sent</option>
          <option value="phase2_marked_complete">Phase 2 complete</option>
        </select>
        <select
          className="input max-w-[180px]"
          value={categoryFilter}
          onChange={(e) => resetPage(setCategoryFilter)(e.target.value)}
        >
          <option value="all">All grant categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {getGrantCategory(c).name}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[180px]"
          value={stateFilter}
          onChange={(e) => resetPage(setStateFilter)(e.target.value)}
        >
          <option value="all">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Grant category</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Referred by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {!apps && !error && (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-line">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <Skeleton className="h-3.5 w-full max-w-[110px]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
            {error && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-bad">
                  {error}
                </td>
              </tr>
            )}
            {apps && !error && pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate">
                  {apps.length === 0 ? "No applications yet." : "No applications match your filters."}
                </td>
              </tr>
            )}
            {pageRows.map((a, i) => {
              const staff = staffById.get(a.referredBy);
              return (
                <tr
                  key={a.applicationId}
                  className="row-rise border-t border-line transition-colors duration-150 hover:bg-paper"
                  style={{ "--delay": `${Math.min(i, 14) * 35}ms` } as CSSProperties}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/applications/${a.applicationId}`}
                      className="font-medium text-ink hover:text-brand hover:underline"
                    >
                      {a.applicantName || "—"}
                    </Link>
                    {a.isTest && (
                      <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">Test</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate">{a.businessName || "—"}</td>
                  <td className="px-4 py-3 text-slate">{a.grantCategory ? getGrantCategory(a.grantCategory).name : "—"}</td>
                  <td className="px-4 py-3 text-slate">{a.stateOfResidence || "—"}</td>
                  <td className="px-4 py-3 text-slate">
                    {a.grantAmount ? `₦${a.grantAmount.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {a.referredBy === "unassigned" ? "Unassigned" : staff?.fullName ?? a.referredBy}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        a.status === "phase2_marked_complete"
                          ? "bg-brand/10 text-brand"
                          : "bg-goldSoft text-ink"
                      }`}
                    >
                      {statusLabel[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {apps && filtered.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate">
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <button
              className="btn-secondary"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
