"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { getCollectionCached, invalidateCollectionCache } from "@/lib/firestoreCache";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import CopyButton from "@/components/CopyButton";
import Skeleton from "@/components/Skeleton";
import HierarchyTree from "@/components/HierarchyTree";
import { buildHierarchyForest, countDescendants, type HierarchyNode } from "@/lib/staffHierarchy";
import { approvePendingStaff, rejectPendingStaff } from "@/app/admin/staff/actions";
import type { StaffRecord, LinkTokenRecord } from "@/lib/types";

interface Row extends StaffRecord {
  link: string;
}

export default function StaffPage() {
  return (
    <AdminGate>
      <AdminShell>
        <StaffTable />
      </AdminShell>
    </AdminGate>
  );
}

function StaffTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"hierarchy" | "list">("hierarchy");
  const [isReviewing, startReview] = useTransition();
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      const [staffData, tokensData] = await Promise.all([
        getCollectionCached<StaffRecord>("staff", { force }),
        getCollectionCached<LinkTokenRecord>("linkTokens", { force }),
      ]);

      const tokenByStaffId = new Map<string, string>();
      for (const t of tokensData) tokenByStaffId.set(t.staffId, t.token);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const result: Row[] = staffData.map((s) => {
        const token = tokenByStaffId.get(s.staffId);
        return {
          ...s,
          link: token ? `${appUrl}/apply/${token}` : "(token not generated yet)",
        };
      });

      result.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setRows(result);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("permission")
          ? "Access denied. Your account isn't in the admins collection yet, or the Firestore rules haven't been published — see the README."
          : "Couldn't load staff data. Please try refreshing.";
      setError(message);
      console.error("Failed to load staff:", err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleApprove(staffId: string) {
    setReviewingId(staffId);
    startReview(async () => {
      await approvePendingStaff(staffId);
      invalidateCollectionCache("staff");
      await load(true);
      setReviewingId(null);
    });
  }

  function handleReject(staffId: string) {
    setReviewingId(staffId);
    startReview(async () => {
      await rejectPendingStaff(staffId);
      invalidateCollectionCache("staff");
      await load(true);
      setReviewingId(null);
    });
  }

  const pending = rows?.filter((r) => r.pendingApproval) ?? [];

  const filtered = rows?.filter(
    (r) =>
      !filter ||
      r.fullName.toLowerCase().includes(filter.toLowerCase()) ||
      r.staffId.toLowerCase().includes(filter.toLowerCase()) ||
      r.tier.toLowerCase().includes(filter.toLowerCase())
  );

  const forest = useMemo(() => buildHierarchyForest(rows ?? []), [rows]);

  function renderTreeRow(node: HierarchyNode<Row>, _depth: number) {
    const r = node.staff;
    const stateCoordCount = node.staff.tier === "Regional Coordinator" ? node.children.length : 0;
    const marketerCount =
      node.staff.tier === "Regional Coordinator"
        ? countDescendants(node, (s) => s.tier === "Marketing Officer")
        : node.staff.tier === "State Coordinator"
          ? node.children.length
          : 0;

    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {r.fullName}
            {r.pendingApproval && (
              <span className="ml-2 rounded-full bg-goldSoft px-2 py-0.5 text-xs font-medium text-ink">Pending</span>
            )}
            {r.staffCodeCorrected && (
              <span
                className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
                title={`Corrected on ${r.staffCodeCorrectedAt ? new Date(r.staffCodeCorrectedAt).toLocaleDateString() : "unknown date"}`}
              >
                Corrected
              </span>
            )}
          </p>
          <p className="text-xs text-slate">{r.tier}</p>
          {r.reportsToName && <p className="text-xs text-slate">Reports to: {r.reportsToName}</p>}
          <div className="mt-1 font-mono text-xs text-slate">
            <span>{r.staffId}</span>
            {r.originalStaffId && (
              <span className="ml-2 text-yellow-700" title="Original staff code before correction">
                (was: {r.originalStaffId})
              </span>
            )}
          </div>
          {(stateCoordCount > 0 || marketerCount > 0) && (
            <p className="mt-1 text-xs font-medium text-brand">
              {r.tier === "Regional Coordinator" && `${stateCoordCount} State Coordinator${stateCoordCount === 1 ? "" : "s"} · ${marketerCount} Marketing Officer${marketerCount === 1 ? "" : "s"}`}
              {r.tier === "State Coordinator" && `${marketerCount} Marketing Officer${marketerCount === 1 ? "" : "s"}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate">{r.link}</span>
          {r.link.startsWith("http") && <CopyButton value={r.link} label="Copy link" />}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-gold">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Staff referral links</h1>
          <p className="mt-1 text-sm text-slate">
            Each link is a token — the real staffId is never shown in the URL.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-line bg-white p-0.5">
            <button
              onClick={() => setView("hierarchy")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "hierarchy" ? "bg-paper text-ink" : "text-slate hover:text-ink"
              }`}
            >
              Hierarchy
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "list" ? "bg-paper text-ink" : "text-slate hover:text-ink"
              }`}
            >
              List
            </button>
          </div>
          {view === "list" && (
            <input
              className="input max-w-xs"
              placeholder="Search name, staffId, tier…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          )}
        </div>
      </header>

      {pending.length > 0 && (
        <div className="card-rise mb-6 overflow-hidden rounded-card border border-gold/30 bg-goldSoft/40">
          <div className="border-b border-gold/30 px-4 py-3">
            <h2 className="font-display text-base font-semibold text-ink">
              Pending approval ({pending.length})
            </h2>
            <p className="text-xs text-slate">
              Regional Coordinators who signed up directly on the site — approve to activate their account.
            </p>
          </div>
          <div className="divide-y divide-gold/20">
            {pending.map((r) => (
              <div key={r.staffId} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-ink">{r.fullName}</p>
                  <p className="text-xs text-slate">
                    {r.email} · {r.phone} · {r.state}
                  </p>
                  <p className="font-mono text-xs text-slate">{r.staffId}</p>
                  {r.homeAddress && <p className="mt-1 text-xs text-slate">{r.homeAddress}</p>}
                  {(r.roleSpecialization || r.stateOfInfluence) && (
                    <p className="mt-1 text-xs text-slate">
                      {r.roleSpecialization}
                      {r.roleSpecialization && r.stateOfInfluence ? " · " : ""}
                      {r.stateOfInfluence ? `Influence: ${r.stateOfInfluence}` : ""}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    {r.ninNumber ? (
                      <span className="font-mono text-slate">NIN: {r.ninNumber}</span>
                    ) : (
                      <span className="text-bad">No NIN provided</span>
                    )}
                    <span className={r.mouAccepted ? "text-brand" : "text-bad"}>
                      MOU {r.mouAccepted ? "acknowledged" : "not acknowledged"}
                    </span>
                    <span className={r.declarationAccepted ? "text-brand" : "text-bad"}>
                      Declaration {r.declarationAccepted ? "accepted" : "not accepted"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(r.staffId)}
                    disabled={isReviewing && reviewingId === r.staffId}
                    className="btn-secondary text-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(r.staffId)}
                    disabled={isReviewing && reviewingId === r.staffId}
                    className="btn-primary text-sm"
                  >
                    {isReviewing && reviewingId === r.staffId ? "Working…" : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "hierarchy" && (
        <div className="overflow-hidden rounded-card border border-line bg-white">
          {!rows && !error && (
            <div className="divide-y divide-line">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-3.5">
                  <Skeleton className="h-3.5 w-full max-w-[220px]" />
                </div>
              ))}
            </div>
          )}
          {error && <p className="px-4 py-8 text-center text-bad">{error}</p>}
          {rows && !error && forest.length === 0 && (
            <p className="px-4 py-8 text-center text-slate">
              No staff yet — staff appear here once they register.
            </p>
          )}
          {rows && !error && forest.length > 0 && (
            <HierarchyTree nodes={forest} renderRow={renderTreeRow} getKey={(s) => s.staffId} />
          )}
        </div>
      )}

      {view === "list" && (
      <div className="overflow-hidden rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="px-4 py-3">S/N</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Staff ID</th>
              <th className="px-4 py-3">Referral link</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!rows && !error && (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-line">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <Skeleton className="h-3.5 w-full max-w-[130px]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
            {error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-bad">
                  {error}
                </td>
              </tr>
            )}
            {rows && !error && filtered?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate">
                  {rows.length === 0
                    ? "No staff yet — staff appear here once they register."
                    : `No staff match "${filter}".`}
                </td>
              </tr>
            )}
            {filtered?.map((r, i) => (
              <tr
                key={r.staffId}
                className="row-rise border-t border-line transition-colors duration-150 hover:bg-paper"
                style={{ "--delay": `${Math.min(i, 14) * 35}ms` } as CSSProperties}
              >
                <td className="px-4 py-3 text-slate">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-ink">{r.fullName}</td>
                <td className="px-4 py-3 text-slate">
                  {r.tier}
                  {r.pendingApproval && (
                    <span className="ml-2 rounded-full bg-goldSoft px-2 py-0.5 text-xs font-medium text-ink">
                      Pending
                    </span>
                  )}
                  {r.staffCodeCorrected && (
                    <span
                      className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
                      title={`Corrected on ${r.staffCodeCorrectedAt ? new Date(r.staffCodeCorrectedAt).toLocaleDateString() : "unknown date"}`}
                    >
                      Corrected
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-slate">
                    <div>{r.staffId}</div>
                    {r.originalStaffId && (
                      <div className="text-yellow-700 text-xs mt-1" title="Original staff code before correction">
                        Was: {r.originalStaffId}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate">{r.link}</td>
                <td className="px-4 py-3 text-right">
                  {r.link.startsWith("http") && <CopyButton value={r.link} label="Copy link" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
