"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import CopyButton from "@/components/CopyButton";
import BrandMark from "@/components/BrandMark";
import type { StaffRecord, LinkTokenRecord } from "@/lib/types";

interface Row extends StaffRecord {
  link: string;
}

export default function StaffPage() {
  return (
    <AdminGate>
      <StaffTable />
    </AdminGate>
  );
}

function StaffTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function load() {
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
      } catch (err) {
        const message =
          err instanceof Error && err.message.includes("permission")
            ? "Access denied. Your account isn't in the admins collection yet, or the Firestore rules haven't been published — see the README."
            : "Couldn't load staff data. Please try refreshing.";
        setError(message);
        console.error("Failed to load staff:", err);
      }
    }
    load();
  }, []);

  const filtered = rows?.filter(
    (r) =>
      !filter ||
      r.fullName.toLowerCase().includes(filter.toLowerCase()) ||
      r.staffId.toLowerCase().includes(filter.toLowerCase()) ||
      r.tier.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <BrandMark size="sm" href="/admin/staff" />
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-gold">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Staff referral links</h1>
          <p className="mt-1 text-sm text-slate">
            Synced from the onboarding sheet. Each link is a token — the real staffId is never
            shown in the URL.
          </p>
        </div>
        <input
          className="input max-w-xs"
          placeholder="Search name, staffId, tier…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </header>

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
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  Loading staff…
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
            {rows && !error && filtered?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  No staff match &ldquo;{filter}&rdquo;.
                </td>
              </tr>
            )}
            {filtered?.map((r) => (
              <tr key={r.staffId} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{r.fullName}</td>
                <td className="px-4 py-3 text-slate">{r.tier}</td>
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
    </main>
  );
}
