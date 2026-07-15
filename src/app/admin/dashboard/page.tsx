"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import BrandMark from "@/components/BrandMark";
import type { ApplicationRecord, StaffRecord } from "@/lib/types";

export default function DashboardPage() {
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}

function Dashboard() {
  const [apps, setApps] = useState<ApplicationRecord[] | null>(null);
  const [staffById, setStaffById] = useState<Map<string, StaffRecord>>(new Map());
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const db = getFirebaseDb();
        const [appsSnap, staffSnap] = await Promise.all([
          getDocs(collection(db, "applications")),
          getDocs(collection(db, "staff")),
        ]);
        setApps(appsSnap.docs.map((d) => d.data() as ApplicationRecord));
        const map = new Map<string, StaffRecord>();
        staffSnap.forEach((d) => map.set(d.id, d.data() as StaffRecord));
        setStaffById(map);
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

  const leaderboard = useMemo(() => {
    if (!apps) return [];
    const counts = new Map<string, { submissions: number; completed: number }>();
    for (const a of apps) {
      const key = a.referredBy || "unassigned";
      const entry = counts.get(key) ?? { submissions: 0, completed: 0 };
      entry.submissions += 1;
      if (a.status === "phase2_marked_complete") entry.completed += 1;
      counts.set(key, entry);
    }
    let rows = Array.from(counts.entries()).map(([staffId, c]) => {
      const staff = staffById.get(staffId);
      return {
        staffId,
        name: staff?.fullName ?? (staffId === "unassigned" ? "Unassigned" : staffId),
        tier: staff?.tier ?? "—",
        submissions: c.submissions,
        completed: c.completed,
        conversionRate: c.submissions ? Math.round((c.completed / c.submissions) * 100) : 0,
      };
    });
    if (tierFilter !== "all") rows = rows.filter((r) => r.tier === tierFilter);
    rows.sort((a, b) => b.submissions - a.submissions);
    return rows;
  }, [apps, staffById, tierFilter]);

  async function markComplete(applicationId: string) {
    await updateDoc(doc(getFirebaseDb(), "applications", applicationId), {
      status: "phase2_marked_complete",
    });
    setApps((prev) =>
      prev
        ? prev.map((a) =>
            a.applicationId === applicationId ? { ...a, status: "phase2_marked_complete" } : a
          )
        : prev
    );
  }

  function exportCsv() {
    if (!apps) return;
    const headers = [
      "applicationId",
      "applicantName",
      "gender",
      "dateOfBirth",
      "phone",
      "email",
      "stateOfResidence",
      "lga",
      "linkedin",
      "businessSocialHandle",
      "currentStatus",
      "hasPriorBusiness",
      "priorBusinessDescription",
      "businessName",
      "businessDescription",
      "industry",
      "supportCategory",
      "businessStage",
      "operatingDuration",
      "dateEstablished",
      "registrationStatus",
      "cacNumber",
      "operatingLocation",
      "employeeCount",
      "hasRevenue",
      "avgMonthlyRevenue",
      "revenueLast12Months",
      "mainCustomers",
      "customerAcquisitionChannels",
      "grantAmountRequested",
      "fundingUse",
      "fundingGrowthExplanation",
      "biggestChallenge",
      "whyStartBusiness",
      "problemSolved",
      "desiredImpact",
      "fiveYearVision",
      "jobsToCreate",
      "whyApplying",
      "whySelected",
      "whatMakesDifferent",
      "appliedBefore",
      "receivedFundingBefore",
      "priorFundingDetails",
      "willingAcademy",
      "willingMentorship",
      "improvementAreas",
      "howHeard",
      "entrepreneurNetwork",
      "referredBy",
      "status",
      "createdAt",
    ];
    const lines = [
      headers.join(","),
      ...apps.map((a) =>
        headers
          .map((h) => {
            const raw = (a as any)[h];
            const cell = Array.isArray(raw) ? raw.join("; ") : raw ?? "";
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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <BrandMark size="sm" href="/admin/staff" />
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-gold">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Leaderboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input max-w-xs"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
          >
            {tiers.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All tiers" : t}
              </option>
            ))}
          </select>
          <button onClick={exportCsv} className="btn-secondary">
            Export CSV
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Phase 1 submissions</th>
              <th className="px-4 py-3">Phase 2 complete</th>
              <th className="px-4 py-3">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {!apps && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  Loading…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-bad">
                  {error}
                </td>
              </tr>
            )}
            {leaderboard.map((r) => (
              <tr key={r.staffId} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                <td className="px-4 py-3 text-slate">{r.tier}</td>
                <td className="px-4 py-3">{r.submissions}</td>
                <td className="px-4 py-3">{r.completed}</td>
                <td className="px-4 py-3">{r.conversionRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 mt-10 font-display text-xl font-semibold text-ink">
        Applications awaiting Phase 2 confirmation
      </h2>
      <div className="overflow-hidden rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Referred by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {apps
              ?.filter((a) => a.status !== "phase2_marked_complete")
              .map((a) => (
                <tr key={a.applicationId} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink">{a.applicantName}</td>
                  <td className="px-4 py-3 text-slate">{a.businessName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate">{a.referredBy}</td>
                  <td className="px-4 py-3 text-slate">{a.status}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => markComplete(a.applicationId)} className="btn-secondary">
                      Mark Phase 2 complete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
