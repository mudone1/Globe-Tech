"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, addDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import Skeleton from "@/components/Skeleton";
import CountUp from "@/components/CountUp";
import type { ApplicationRecord, StaffRecord, PayoutSettingsRecord, PayoutRecord } from "@/lib/types";

export default function PayoutsPage() {
  return (
    <AdminGate>
      <AdminShell>
        <Payouts />
      </AdminShell>
    </AdminGate>
  );
}

interface StaffPayoutRow {
  staffId: string;
  name: string;
  tier: string;
  completed: number;
  earned: number;
  paid: number;
  outstanding: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function Payouts() {
  const [apps, setApps] = useState<ApplicationRecord[] | null>(null);
  const [staffById, setStaffById] = useState<Map<string, StaffRecord>>(new Map());
  const [payoutRecords, setPayoutRecords] = useState<(PayoutRecord & { docId: string })[]>([]);
  const [rate, setRate] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    try {
      const db = getFirebaseDb();
      const [appsSnap, staffSnap, payoutSnap, settingsSnap] = await Promise.all([
        getDocs(collection(db, "applications")),
        getDocs(collection(db, "staff")),
        getDocs(collection(db, "payoutRecords")),
        getDoc(doc(db, "payoutSettings", "rate")),
      ]);
      setApps(appsSnap.docs.map((d) => d.data() as ApplicationRecord));
      const map = new Map<string, StaffRecord>();
      staffSnap.forEach((d) => {
        const s = d.data() as StaffRecord;
        map.set(s.staffId, s);
      });
      setStaffById(map);
      setPayoutRecords(payoutSnap.docs.map((d) => ({ ...(d.data() as PayoutRecord), docId: d.id })));
      if (settingsSnap.exists()) {
        setRate((settingsSnap.data() as PayoutSettingsRecord).perCompletionAmount);
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("permission")
          ? "Access denied. Your account isn't in the admins collection yet, or the Firestore rules haven't been published — see the README."
          : "Couldn't load payout data. Please try refreshing.";
      setError(message);
      console.error("Failed to load payouts:", err);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const rows = useMemo<StaffPayoutRow[]>(() => {
    if (!apps) return [];
    const completedByStaff = new Map<string, number>();
    for (const a of apps) {
      if (a.status !== "phase2_marked_complete") continue;
      const key = a.referredBy || "unassigned";
      completedByStaff.set(key, (completedByStaff.get(key) ?? 0) + 1);
    }
    const paidByStaff = new Map<string, number>();
    for (const p of payoutRecords) {
      paidByStaff.set(p.staffId, (paidByStaff.get(p.staffId) ?? 0) + p.amount);
    }
    const staffIds = new Set([...completedByStaff.keys(), ...paidByStaff.keys()]);
    const result: StaffPayoutRow[] = Array.from(staffIds)
      .filter((id) => id !== "unassigned")
      .map((staffId) => {
        const staff = staffById.get(staffId);
        const completed = completedByStaff.get(staffId) ?? 0;
        const earned = completed * rate;
        const paid = paidByStaff.get(staffId) ?? 0;
        return {
          staffId,
          name: staff?.fullName ?? staffId,
          tier: staff?.tier ?? "—",
          completed,
          earned,
          paid,
          outstanding: earned - paid,
        };
      });
    result.sort((a, b) => b.outstanding - a.outstanding);
    return result;
  }, [apps, staffById, payoutRecords, rate]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        earned: acc.earned + r.earned,
        paid: acc.paid + r.paid,
        outstanding: acc.outstanding + r.outstanding,
      }),
      { earned: 0, paid: 0, outstanding: 0 }
    );
  }, [rows]);

  async function recordPayment(staffId: string) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const uid = getFirebaseAuth().currentUser?.uid;
      const record: Omit<PayoutRecord, "id"> = {
        staffId,
        amount: amt,
        paidAt: new Date().toISOString(),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(uid ? { recordedBy: uid } : {}),
      };
      await addDoc(collection(getFirebaseDb(), "payoutRecords"), record);
      setRecordingFor(null);
      setAmount("");
      setNote("");
      await loadAll();
    } catch (err) {
      setError("Couldn't record that payment. Please try again.");
      console.error("Failed to record payment:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-gold">Admin</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Payouts</h1>
        <p className="mt-1 text-sm text-slate">
          {rate > 0
            ? `₦${rate.toLocaleString()} per completed referral. Adjust this on the Settings page.`
            : "No payout rate set yet — go to Settings to configure one."}
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {!apps && !error ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-3 h-7 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card-rise rounded-2xl border border-line bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate">Total earned</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">
              ₦<CountUp value={totals.earned} />
            </p>
          </div>
          <div className="card-rise rounded-2xl border border-line bg-white p-5 shadow-sm" style={{ animationDelay: "70ms" }}>
            <p className="text-xs uppercase tracking-wide text-slate">Total paid</p>
            <p className="mt-1 font-display text-2xl font-semibold text-good">
              ₦<CountUp value={totals.paid} />
            </p>
          </div>
          <div className="card-rise rounded-2xl border border-line bg-white p-5 shadow-sm" style={{ animationDelay: "140ms" }}>
            <p className="text-xs uppercase tracking-wide text-slate">Outstanding</p>
            <p className="mt-1 font-display text-2xl font-semibold text-bad">
              ₦<CountUp value={totals.outstanding} />
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Earned</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Outstanding</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {apps && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate">
                  No completed referrals yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <Fragment key={r.staffId}>
                <tr className="border-t border-line hover:bg-paper">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-xs font-semibold text-brand">
                        {initials(r.name)}
                      </div>
                      <span className="font-medium text-ink">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate">{r.tier}</td>
                  <td className="px-4 py-3">{r.completed}</td>
                  <td className="px-4 py-3 font-medium text-ink">₦{r.earned.toLocaleString()}</td>
                  <td className="px-4 py-3 text-good">₦{r.paid.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-medium ${r.outstanding > 0 ? "text-bad" : "text-slate"}`}>
                    ₦{r.outstanding.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => {
                        setRecordingFor(recordingFor === r.staffId ? null : r.staffId);
                        setAmount("");
                        setNote("");
                        setError(null);
                      }}
                    >
                      {recordingFor === r.staffId ? "Cancel" : "Record payment"}
                    </button>
                  </td>
                </tr>
                {recordingFor === r.staffId && (
                  <tr className="border-t border-line bg-paper/60">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-medium text-ink">Amount (₦)</span>
                          <input
                            className="input w-40"
                            type="number"
                            min={0}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            autoFocus
                          />
                        </label>
                        <label className="block flex-1 min-w-[180px]">
                          <span className="mb-1.5 block text-xs font-medium text-ink">Note (optional)</span>
                          <input
                            className="input"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. Bank transfer, July batch"
                          />
                        </label>
                        <button
                          className="btn-primary text-sm"
                          disabled={saving}
                          onClick={() => recordPayment(r.staffId)}
                        >
                          {saving ? "Saving…" : "Save payment"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
