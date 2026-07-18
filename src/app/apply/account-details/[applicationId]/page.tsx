"use client";

import { useEffect, useState, use as usePromise } from "react";
import Image from "next/image";
import { getContinuationStatus, submitAccountDetails, type ContinuationStatus } from "@/app/apply/account-details/actions";
import styles from "@/components/ChatApplicationForm.module.css";

function timeRemaining(unlocksAt: string): string {
  const ms = new Date(unlocksAt).getTime() - Date.now();
  if (ms <= 0) return "any moment now";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AccountDetailsPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = usePromise(params);
  return <AccountDetails applicationId={applicationId} />;
}

function AccountDetails({ applicationId }: { applicationId: string }) {
  const [status, setStatus] = useState<ContinuationStatus | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getContinuationStatus(applicationId).then(setStatus);
  }, [applicationId]);

  async function handleSubmit() {
    if (!accountNumber.trim() || !accountName.trim()) {
      setError("Enter both your account number and account name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await submitAccountDetails(applicationId, accountNumber, accountName);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className={styles.page}>
      <div className={styles.app}>
        <header className={styles.header}>
          <div style={{ width: 30 }} />
          <div className={styles.mark}>
            <Image src="/logo.png" alt="Globe-Tech" width={34} height={34} className={styles.markImg} priority />
          </div>
          <div className={styles.headText}>
            <div className={styles.org}>Globe-Tech · SME Grant Program</div>
            <div className={styles.roleLabel}>FirstBank Account Details</div>
          </div>
        </header>

        <div className={styles.thread} style={{ paddingTop: 20 }}>
          {!status && <p style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>Loading…</p>}

          {status && !status.ok && (
            <div className={styles.statusCard}>
              <p className={styles.statusLabel}>Not found</p>
              <h2>Hmm, that link isn&rsquo;t working</h2>
              <p>{status.error}</p>
            </div>
          )}

          {status && status.ok && (
            <>
              <div className={styles.welcomeHero}>
                <h1>Hi {status.applicantName.split(/\s+/)[0]},</h1>
                <p>
                  {status.businessName} · {status.grantCategoryName}
                </p>
              </div>

              {!status.unlocked && (
                <div className={styles.statusCard}>
                  <p className={styles.statusLabel}>Phase 2 · Pending</p>
                  <h2>Available in {timeRemaining(status.unlocksAt)}</h2>
                  <p>
                    First, finish opening your FirstSME Basic account with FirstBank if you
                    haven&rsquo;t already. Once your 48-hour waiting period is up, come back to
                    this exact link to submit your account details. Bookmark it or keep the email
                    handy.
                  </p>
                </div>
              )}

              {status.unlocked && !status.accountDetailsSubmitted && !submitted && (
                <>
                  <div className={styles.warningBox}>
                    <b>Warning:</b> You must provide the FirstBank SME account issued to you
                    during the account opening process. Submitting any account other than your
                    official FirstBank SME account will result in automatic disqualification from
                    the grant program.
                  </div>
                  <div className={styles.composerInner}>
                    <label style={{ display: "block", marginBottom: 12 }}>
                      <span style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--muted)" }}>
                        FirstBank account number
                      </span>
                      <input
                        className={styles.field}
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="0123456789"
                      />
                    </label>
                    <label style={{ display: "block", marginBottom: 4 }}>
                      <span style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--muted)" }}>
                        Account name (exactly as shown on your FirstBank account)
                      </span>
                      <input className={styles.field} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                    </label>
                    <div className={styles.rowActions}>
                      <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={submitting} onClick={handleSubmit}>
                        {submitting ? "Submitting…" : "Submit account details →"}
                      </button>
                    </div>
                    {error && <p className={styles.errorText}>{error}</p>}
                  </div>
                </>
              )}

              {(status.accountDetailsSubmitted || submitted) && (
                <div className={styles.statusCard}>
                  <p className={styles.statusLabel}>{submitted ? "Awaiting Verification" : status.verificationLabel}</p>
                  <h2>
                    {submitted
                      ? "Got it — thanks!"
                      : status.verificationLabel === "Completed"
                        ? "You're fully verified 🎉"
                        : "Still checking"}
                  </h2>
                  <p>
                    {submitted
                      ? "We've saved your account details. We'll verify them against FirstBank's records and let you know."
                      : status.verificationDescription}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
