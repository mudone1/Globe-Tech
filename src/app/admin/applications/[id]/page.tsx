"use client";

import { useEffect, useState, use as usePromise, type CSSProperties } from "react";
import Link from "next/link";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import CopyButton from "@/components/CopyButton";
import { getApplicationFieldGroups, formatFieldValue } from "@/lib/applicationFields";
import { getGrantCategory } from "@/lib/grantCategories";
import { isPhase2Unlocked, phase2UnlocksAt, PHASE2_STATUS_INFO } from "@/lib/phase2Status";
import type { ApplicationRecord, StaffRecord, Phase2VerificationStatus } from "@/lib/types";

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

  async function markInvalid() {
    if (!record) return;
    setMarking(true);
    try {
      await updateDoc(doc(getFirebaseDb(), "applications", record.applicationId), {
        phase2VerificationStatus: "invalid_account" satisfies Phase2VerificationStatus,
      });
      setRecord({ ...record, phase2VerificationStatus: "invalid_account" });
    } finally {
      setMarking(false);
    }
  }

  async function markCompleteManually() {
    if (!record) return;
    setMarking(true);
    try {
      await updateDoc(doc(getFirebaseDb(), "applications", record.applicationId), {
        status: "phase2_marked_complete",
        phase2VerificationStatus: "completed" satisfies Phase2VerificationStatus,
        phase2VerifiedAt: new Date().toISOString(),
      });
      setRecord({ ...record, status: "phase2_marked_complete", phase2VerificationStatus: "completed" });
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
          <header className="card-rise mt-4 mb-8 rounded-card border border-line bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-gold">
                  {getGrantCategory(record.grantCategory).name}
                </p>
                <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{record.applicantName}</h1>
                <p className="mt-1 text-sm text-slate">{record.businessName}</p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                    record.status === "phase2_marked_complete" ? "bg-brand/10 text-brand" : "bg-goldSoft text-ink"
                  }`}
                >
                  {record.phase2VerificationStatus
                    ? PHASE2_STATUS_INFO[record.phase2VerificationStatus].label
                    : isPhase2Unlocked(record.phase1SubmittedAt)
                      ? "Phase 2 · Awaiting account details"
                      : `Phase 2 locked until ${phase2UnlocksAt(record.phase1SubmittedAt).toLocaleString("en-NG")}`}
                </span>
                {record.status !== "phase2_marked_complete" && record.accountDetailsSubmittedAt && (
                  <div className="mt-3 flex flex-col gap-2">
                    <button onClick={markCompleteManually} disabled={marking} className="btn-primary text-sm">
                      {marking ? "Working…" : "Manually mark complete"}
                    </button>
                    {record.phase2VerificationStatus !== "invalid_account" && (
                      <button onClick={markInvalid} disabled={marking} className="btn-secondary text-sm">
                        Mark invalid account
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {record.accountDetailsSubmittedAt && (
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-slate">Bank account number</p>
                  <p className="font-mono font-medium text-ink">{record.bankAccountNumber}</p>
                </div>
                <div>
                  <p className="text-slate">Bank account name</p>
                  <p className="font-medium text-ink">{record.bankAccountName}</p>
                </div>
              </div>
            )}

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
                <p className="text-slate">Grant amount</p>
                <p className="font-medium text-ink">
                  {record.grantAmount ? `₦${record.grantAmount.toLocaleString()}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate">Grant Code</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-medium text-ink">{record.grantCode}</p>
                  {record.grantCode && (
                    <CopyButton value={record.grantCode} label="Copy" />
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-6">
            {getApplicationFieldGroups(record).map((group, i) => (
              <section
                key={group.title}
                className="card-rise rounded-card border border-line bg-white p-6 shadow-sm"
                style={{ "--delay": `${Math.min(i, 8) * 60}ms` } as CSSProperties}
              >
                <h2 className="mb-4 font-display text-lg font-semibold text-ink">{group.title}</h2>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <div key={field.key}>
                      <dt className="text-xs uppercase tracking-wide text-slate">{field.label}</dt>
                      {field.type === "link" && record[field.key] ? (
                        <dd className="mt-1 text-sm">
                          <a
                            href={String(record[field.key])}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline"
                          >
                            View document ↗
                          </a>
                        </dd>
                      ) : (
                        <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{formatFieldValue(record, field)}</dd>
                      )}
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
