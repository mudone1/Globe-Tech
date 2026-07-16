"use client";

import { useCallback, useEffect, useState, useTransition, type CSSProperties } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import CopyButton from "@/components/CopyButton";
import Skeleton from "@/components/Skeleton";
import { runStaffSync, approvePendingStaff, rejectPendingStaff } from "@/app/admin/staff/actions";
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
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, startSync] = useTransition();
  const [isReviewing, startReview] = useTransition();
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const db = getFirebaseDb();
      const [staffSnap, tokensSnap] = await Promise.all([
        getDocs(collection(db, "staff")),
        getDocs(collection(db, "linkTokens")),
      ]);

      const tokenByStaffId = new Map<string, string>();
      tokensSnap.forEach((d) => {
        const t = d.data() as LinkTokenRecord;
        tokenByStaffId.set(t.staffId, t.token);
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const result: Row[] = staffSnap.docs.map((d) => {
        const s = d.data() as StaffRecord;
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

  function handleSync() {
    setSyncMessage(null);
    startSync(async () => {
      const result = await runStaffSync();
      if (!result.ok) {
        setSyncMessage(`Sync failed: ${result.error}`);
        return;
      }
      const warningNote = result.warnings?.length ? ` (${result.warnings.join(" ")})` : "";
      setSyncMessage(`Synced ${result.staffSynced} staff record(s).${warningNote}`);
      await load();
    });
  }

  function handleApprove(staffId: string) {
    setReviewingId(staffId);
    startReview(async () => {
      await approvePendingStaff(staffId);
      await load();
      setReviewingId(null);
    });
  }

  function handleReject(staffId: string) {
    setReviewingId(staffId);
    startReview(async () => {
      await rejectPendingStaff(staffId);
      await load();
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

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-gold">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Staff referral links</h1>
          <p className="mt-1 text-sm text-slate">
            Synced from the onboarding sheet. Each link is a token — the real staffId is never
            shown in the URL.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder="Search name, staffId, tier…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button onClick={handleSync} disabled={isSyncing} className="btn-primary whitespace-nowrap">
            {isSyncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </header>

      {syncMessage && (
        <p
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            syncMessage.startsWith("Sync failed") ? "bg-bad/10 text-bad" : "bg-goldSoft text-ink"
          }`}
        >
          {syncMessage}
        </p>
      )}

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
                    {r.idCardUrl ? (
                      <a href={r.idCardUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        View ID card ↗
                      </a>
                    ) : (
                      <span className="text-bad">No ID card uploaded</span>
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

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
            <tr>
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
                    {Array.from({ length: 5 }).map((_, j) => (
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
                <td colSpan={5} className="px-4 py-8 text-center text-bad">
                  {error}
                </td>
              </tr>
            )}
            {rows && !error && filtered?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  {rows.length === 0
                    ? 'No staff synced yet — click "Sync now" above.'
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
                <td className="px-4 py-3 font-medium text-ink">{r.fullName}</td>
                <td className="px-4 py-3 text-slate">
                  {r.tier}
                  {r.pendingApproval && (
                    <span className="ml-2 rounded-full bg-goldSoft px-2 py-0.5 text-xs font-medium text-ink">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate">{r.staffId}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate">{r.link}</td>
                <td className="px-4 py-3 text-right">
                  {r.link.startsWith("http") && <CopyButton value={r.link} label="Copy link" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
