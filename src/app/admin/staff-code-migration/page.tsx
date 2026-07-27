"use client";

import { useState } from "react";
import { previewMigration, executeMigration } from "./actions";
import type { MigrationResult } from "@/lib/staffCodeMigration";

export default function StaffCodeMigrationPage() {
  const [preview, setPreview] = useState<MigrationResult | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await previewMigration();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!window.confirm("This will permanently correct all invalid staff codes. Continue?")) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await executeMigration();
      setResult(data);
      if (data.success) {
        setPreview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-ink">Staff Code Migration</h1>
        <p className="mt-2 text-slate">Fix all existing invalid staff codes to use the correct fixed suffix.</p>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-red-800 font-medium">Error: {error}</p>
          </div>
        )}

        {/* Preview Section */}
        {!result && (
          <div className="mt-8 space-y-4">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Preview Migration"}
            </button>

            {preview && (
              <div className="mt-6 space-y-4">
                <div className="bg-white rounded-lg border border-line p-6">
                  <h2 className="text-xl font-bold text-ink">Migration Preview</h2>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-slate">Total Records</p>
                      <p className="text-2xl font-bold text-ink">{preview.totalRecords}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate">To Correct</p>
                      <p className="text-2xl font-bold text-amber-600">{preview.correctedCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate">Referral Updates</p>
                      <p className="text-2xl font-bold text-ink">{preview.referralUpdatesCount}</p>
                    </div>
                  </div>

                  {preview.corrections.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-bold text-ink">Corrections to be Applied:</h3>
                      <div className="mt-3 max-h-96 overflow-y-auto space-y-2">
                        {preview.corrections.map((correction, idx) => (
                          <div
                            key={idx}
                            className="bg-amber-50 border border-amber-200 p-3 rounded text-sm"
                          >
                            <p className="font-medium text-ink">{correction.userName}</p>
                            <p className="text-xs text-slate mt-1">
                              {correction.originalStaffId} → {correction.newStaffId}
                            </p>
                            {correction.affectedReferrals > 0 && (
                              <p className="text-xs text-amber-700 mt-1">
                                {correction.affectedReferrals} user(s) referencing this code
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleExecute}
                    disabled={loading}
                    className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? "Running..." : "Execute Migration"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="mt-6 bg-white rounded-lg border border-line p-6">
            <div
              className={`flex items-center gap-2 ${
                result.success ? "text-green-600" : "text-red-600"
              }`}
            >
              <span className="text-2xl">{result.success ? "✓" : "✗"}</span>
              <h2 className="text-xl font-bold">
                {result.success ? "Migration Completed Successfully" : "Migration Failed"}
              </h2>
            </div>

            {result.success && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate">Corrected</p>
                    <p className="text-2xl font-bold text-green-600">{result.correctedCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate">Referral Updates</p>
                    <p className="text-2xl font-bold text-ink">{result.referralUpdatesCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate">Total Records</p>
                    <p className="text-2xl font-bold text-ink">{result.totalRecords}</p>
                  </div>
                </div>

                {result.emailsSent !== undefined && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h3 className="font-bold text-blue-900">Email Notifications</h3>
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-blue-700">Sent Successfully</p>
                        <p className="text-xl font-bold text-blue-900">{result.emailsSent}</p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-700">Failed</p>
                        <p className="text-xl font-bold text-blue-900">{result.emailsFailed}</p>
                      </div>
                    </div>
                    {result.emailErrors && result.emailErrors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-blue-900">Failed Emails:</p>
                        <ul className="mt-2 space-y-1 text-sm text-blue-800">
                          {result.emailErrors.map((err, idx) => (
                            <li key={idx}>
                              {err.email}: {err.error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {result.corrections.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-ink">Corrected Users (for manual notification):</h3>
                <div className="mt-3 max-h-96 overflow-y-auto space-y-2">
                  {result.corrections.map((correction, idx) => (
                    <div key={idx} className="bg-green-50 border border-green-200 p-3 rounded text-sm">
                      <p className="font-medium text-ink">{correction.userName}</p>
                      <p className="text-xs text-slate mt-1">
                        Old: {correction.originalStaffId}
                      </p>
                      <p className="text-xs text-slate">New: {correction.newStaffId}</p>
                      {correction.affectedReferrals > 0 && (
                        <p className="text-xs text-green-700 mt-1">
                          {correction.affectedReferrals} referral(s) updated
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
    </div>
  );
}
