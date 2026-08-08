"use client";

import { useState } from "react";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import { previewDedup, executeDedup } from "./actions";
import type { DedupPreviewResult, DedupExecuteResult } from "@/lib/applicationDedup";

export default function ApplicationDedupPage() {
  return (
    <AdminGate>
      <AdminShell>
        <ApplicationDedup />
      </AdminShell>
    </AdminGate>
  );
}

function ApplicationDedup() {
  const [preview, setPreview] = useState<DedupPreviewResult | null>(null);
  const [result, setResult] = useState<DedupExecuteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    try {
      setPreview(await previewDedup());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (
      !window.confirm(
        "This will archive and remove duplicate application records for every group that doesn't need manual review. Groups with conflicting staff codes are skipped automatically. Continue?"
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await executeDedup();
      setResult(data);
      if (data.success) setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold text-ink">Duplicate Application Cleanup</h1>
      <p className="mt-2 text-slate">
        Finds applications that share the same phone number, picks one record to keep per group, and
        archives the rest (recoverable in the <code>applicationDuplicatesArchive</code> collection)
        before deleting them from <code>applications</code>. Groups with conflicting staff codes are
        never auto-resolved — review them manually first.
      </p>

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-red-800 font-medium">Error: {error}</p>
        </div>
      )}

      {!result && (
        <div className="mt-8 space-y-4">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Preview Duplicates"}
          </button>

          {preview && (
            <div className="mt-6 space-y-4">
              <div className="bg-white rounded-lg border border-line p-6">
                <h2 className="text-xl font-bold text-ink">Preview</h2>
                <div className="mt-4 grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-slate">Total Applications</p>
                    <p className="text-2xl font-bold text-ink">{preview.totalApplications}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate">Duplicate Groups</p>
                    <p className="text-2xl font-bold text-ink">{preview.totalGroups}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate">Safe to Resolve</p>
                    <p className="text-2xl font-bold text-green-600">{preview.groupsSafeToResolve}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate">Needs Review</p>
                    <p className="text-2xl font-bold text-amber-600">{preview.groupsNeedingReview}</p>
                  </div>
                </div>

                {preview.groups.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-bold text-ink">Groups:</h3>
                    <div className="mt-3 max-h-[32rem] overflow-y-auto space-y-3">
                      {preview.groups.map((g) => (
                        <div
                          key={g.phoneNormalized}
                          className={`p-4 rounded border text-sm ${
                            g.needsReview ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-xs text-slate">{g.phoneNormalized}</p>
                            {g.needsReview && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                Needs review — excluded from Execute
                              </span>
                            )}
                          </div>
                          {g.needsReview && g.reviewReason && (
                            <p className="mt-1 text-xs text-red-700">{g.reviewReason}</p>
                          )}
                          <div className="mt-2 space-y-1">
                            {g.members.map((m) => (
                              <div
                                key={m.applicationId}
                                className={`text-xs ${m.applicationId === g.keptApplicationId ? "text-green-700 font-medium" : "text-slate"}`}
                              >
                                {m.applicationId === g.keptApplicationId ? "✓ KEEP" : "✗ archive"} — {m.applicantName} ·{" "}
                                {m.referredBy} · {m.hasBankDetails ? "has bank details" : "no bank details"} ·{" "}
                                {new Date(m.createdAt).toLocaleDateString()}
                              </div>
                            ))}
                          </div>
                          {!g.needsReview && <p className="mt-2 text-xs text-ink font-medium">Why kept: {g.keptReason}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {preview.totalGroups === 0 && <p className="mt-4 text-sm text-slate">No duplicate phone numbers found.</p>}

                {preview.groupsSafeToResolve > 0 && (
                  <button
                    onClick={handleExecute}
                    disabled={loading}
                    className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? "Running..." : `Execute — clean up ${preview.groupsSafeToResolve} group(s)`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="mt-6 bg-white rounded-lg border border-line p-6">
          <div className={`flex items-center gap-2 ${result.success ? "text-green-600" : "text-red-600"}`}>
            <span className="text-2xl">{result.success ? "✓" : "✗"}</span>
            <h2 className="text-xl font-bold">{result.success ? "Cleanup Completed" : "Cleanup Failed"}</h2>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate">Groups Processed</p>
              <p className="text-2xl font-bold text-green-600">{result.groupsProcessed}</p>
            </div>
            <div>
              <p className="text-sm text-slate">Applications Archived</p>
              <p className="text-2xl font-bold text-ink">{result.applicationsArchived}</p>
            </div>
            <div>
              <p className="text-sm text-slate">Skipped for Review</p>
              <p className="text-2xl font-bold text-amber-600">{result.groupsSkippedForReview}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold text-red-600">Errors:</h3>
              <ul className="mt-2 space-y-1 text-sm text-red-600">
                {result.errors.map((err, idx) => (
                  <li key={idx}>• {err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
