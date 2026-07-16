"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import CopyButton from "@/components/CopyButton";
import { APPLICATION_FIELD_GROUPS, formatFieldValue } from "@/lib/applicationFields";
import type { ApplicationRecord, StaffRecord } from "@/lib/types";

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  return (
    <AdminGate>
      <AdminShell>
        <ApplicationDetail id={id} />
      </AdminShell>
    </AdminGate>
  );
}

function ApplicationDetail({ id }: { id: string }) {
  const [record, setRecord] = useState<ApplicationRecord | null>(null);
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, "applications", id));
        if (!snap.exists()) {
          setError("Application not found.");
          return;
        }
        const data = snap.data() as ApplicationRecord;
        setRecord(data);

        if (data.referredBy && data.referredBy !== "unassigned") {
          // referredBy is the real staffId, which may contain a "/" — Firestore doc
          // IDs can't, so staff docs are keyed by a sanitized ID. Since we don't
          // know that sanitization here, look the record up by its staffId field
          // instead of assuming the doc ID matches.
          const { collection, getDocs, query, where } = await import("firebase/firestore");
          const staffQuery = query(collection(db, "staff"), where("staffId", "==", data.referredBy));
          const staffSnap = await getDocs(staffQuery);
          if (!staffSnap.empty) setStaff(staffSnap.docs[0]!.data() as StaffRecord);
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message.includes("permission")
            ? "Access denied. Your account isn't in the admins collection yet, or the Firestore rules haven't been published — see the README."
            : "Couldn't load this application. Please try refreshing.";
        setError(message);
        console.error("Failed to load application:", err);
      }
    }
    load();
  }, [id]);

  async function markComplete() {
    if (!record) return;
    setMarking(true);
    try {
      await updateDoc(doc(getFirebaseDb(), "applications", record.applicationId), {
        status: "phase2_marked_complete",
      });
      setRecord({ ...record, status: "phase2_marked_complete" });
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/applications" className="text-sm text-slate hover:text-ink">
        ← Back to applications
      </Link>

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {!record && !error && <p className="mt-6 text-slate">Loading…</p>}

      {record && (
        <>
          <header className="mt-4 mb-8 rounded-card border border-line bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-gold">
                  {record.supportCategory || "Application"}
                </p>
                <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{record.applicantName}</h1>
                <p className="mt-1 text-sm text-slate">
                  {record.businessName} · {record.industry}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                    record.status === "phase2_marked_complete" ? "bg-brand/10 text-brand" : "bg-goldSoft text-ink"
                  }`}
                >
                  {record.status === "phase2_marked_complete"
                    ? "Phase 2 complete"
                    : record.status === "phase2_email_sent"
                      ? "Phase 2 email sent"
                      : "Phase 1 submitted"}
                </span>
                {record.status !== "phase2_marked_complete" && (
                  <button onClick={markComplete} disabled={marking} className="mt-3 block btn-primary text-sm">
                    {marking ? "Marking…" : "Mark Phase 2 complete"}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm sm:grid-cols-4">
              <div>
                <p className="text-slate">Referred by</p>
                <p className="font-medium text-ink">
                  {record.referredBy === "unassigned" ? "Unassigned" : staff?.fullName ?? record.referredBy}
                </p>
              </div>
              <div>
                <p className="text-slate">Submitted</p>
                <p className="font-medium text-ink">
                  {record.createdAt
                    ? new Date(record.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate">Amount requested</p>
                <p className="font-medium text-ink">
                  {record.grantAmountRequested ? `₦${record.grantAmountRequested.toLocaleString()}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate">FirstBank referral code</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-medium text-ink">{record.firstBankReferralCode}</p>
                  {record.firstBankReferralCode && (
                    <CopyButton value={record.firstBankReferralCode} label="Copy" />
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-6">
            {APPLICATION_FIELD_GROUPS.map((group) => (
              <section key={group.title} className="rounded-card border border-line bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-display text-lg font-semibold text-ink">{group.title}</h2>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <div key={field.key}>
                      <dt className="text-xs uppercase tracking-wide text-slate">{field.label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{formatFieldValue(record, field)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
