"use client";

import { useEffect, useRef, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import { uploadBankValidationFile, listBankValidationBatches, type BankValidationBatchSummary } from "@/app/admin/verification/actions";
import { PHASE2_STATUS_INFO } from "@/lib/phase2Status";
import type { ApplicationRecord, Phase2VerificationStatus } from "@/lib/types";

export default function VerificationPage() {
  return (
    <AdminGate>
      <AdminShell>
        <Verification />
      </AdminShell>
    </AdminGate>
  );
}

const PENDING_STATUSES: Phase2VerificationStatus[] = ["awaiting_verification", "account_type_not_verified", "verification_failed"];

function Verification() {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BankValidationBatchSummary[] | null>(null);
  const [pending, setPending] = useState<ApplicationRecord[] | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadPending() {
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(query(collection(db, "applications"), where("phase2VerificationStatus", "in", PENDING_STATUSES)));
      setPending(snap.docs.map((d) => d.data() as ApplicationRecord));
    } catch (err) {
      console.error("Failed to load pending verifications:", err);
    }
  }

  async function loadBatches() {
    try {
      setBatches(await listBankValidationBatches());
    } catch (err) {
      console.error("Failed to load batch history:", err);
    }
  }

  useEffect(() => {
    loadPending();
    loadBatches();
  }, []);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setUploadError("Choose a file first.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadBankValidationFile(formData);
    setUploading(false);
    if (!res.ok) {
      setUploadError(res.error);
      return;
    }
    setUploadResult(
      `Processed ${res.rowCount} rows: ${res.matchedCount} fully verified, ${res.partialCount} name-matched but account unconfirmed.`
    );
    if (fileRef.current) fileRef.current.value = "";
    await Promise.all([loadPending(), loadBatches()]);
  }

  async function markInvalid(applicationId: string) {
    setActingOn(applicationId);
    try {
      await updateDoc(doc(getFirebaseDb(), "applications", applicationId), {
        phase2VerificationStatus: "invalid_account" satisfies Phase2VerificationStatus,
      });
      await loadPending();
    } finally {
      setActingOn(null);
    }
  }

  async function markCompleteManually(applicationId: string) {
    setActingOn(applicationId);
    try {
      await updateDoc(doc(getFirebaseDb(), "applications", applicationId), {
        phase2VerificationStatus: "completed" satisfies Phase2VerificationStatus,
        phase2VerifiedAt: new Date().toISOString(),
        status: "phase2_marked_complete",
      });
      await loadPending();
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-gold">Admin</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Phase 2 Verification</h1>
        <p className="mt-1 text-sm text-slate">
          Upload FirstBank's account validation data to automatically verify applicants' Phase 2
          account details. Account numbers and names here are sensitive — this page and the raw
          upload data are admin-only.
        </p>
      </header>

      <div className="mb-6 rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h2 className="font-display text-base font-semibold text-ink">Upload validation file</h2>
        <p className="mt-1 text-sm text-slate">
          CSV or Excel file with <strong>Account Number</strong> and <strong>Account Name</strong> columns
          (an optional Reference column is fine too). Every applicant currently awaiting verification is
          automatically re-checked against this file.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="input max-w-xs" />
          <button onClick={handleUpload} disabled={uploading} className="btn-primary">
            {uploading ? "Processing…" : "Upload & verify"}
          </button>
        </div>
        {uploadResult && <p className="mt-3 rounded-md bg-good/10 px-3 py-2 text-sm text-good">{uploadResult}</p>}
        {uploadError && <p className="mt-3 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{uploadError}</p>}
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-display text-base font-semibold text-ink">Upload history</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3">Rows</th>
              <th className="px-4 py-3">Fully verified</th>
              <th className="px-4 py-3">Name-matched only</th>
            </tr>
          </thead>
          <tbody>
            {batches && batches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  No uploads yet.
                </td>
              </tr>
            )}
            {batches?.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink">{b.fileName}</td>
                <td className="px-4 py-3 text-slate">{new Date(b.uploadedAt).toLocaleString("en-NG")}</td>
                <td className="px-4 py-3">{b.rowCount}</td>
                <td className="px-4 py-3 text-good">{b.matchedCount}</td>
                <td className="px-4 py-3 text-gold">{b.partialCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-display text-base font-semibold text-ink">Pending verification</h2>
          <p className="mt-1 text-sm text-slate">Applicants who've submitted account details but aren't fully verified yet.</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Account name</th>
              <th className="px-4 py-3">Account number</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pending && pending.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  Nobody's pending verification right now.
                </td>
              </tr>
            )}
            {pending?.map((a) => (
              <tr key={a.applicationId} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{a.applicantName}</td>
                <td className="px-4 py-3 text-slate">{a.bankAccountName}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate">{a.bankAccountNumber}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-goldSoft px-2.5 py-1 text-xs font-medium text-ink">
                    {a.phase2VerificationStatus ? PHASE2_STATUS_INFO[a.phase2VerificationStatus].label : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      className="btn-secondary text-xs"
                      disabled={actingOn === a.applicationId}
                      onClick={() => markInvalid(a.applicationId)}
                    >
                      Mark invalid
                    </button>
                    <button
                      className="btn-primary text-xs"
                      disabled={actingOn === a.applicationId}
                      onClick={() => markCompleteManually(a.applicationId)}
                    >
                      Mark complete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
