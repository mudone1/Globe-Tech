"use client";

import { useEffect, useState, Suspense, use as usePromise } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { getContinuationStatus, submitAccountDetails, type ContinuationStatus } from "@/app/apply/account-details/actions";
import { isLikelyPersonName, ACCOUNT_NAME_ERROR } from "@/lib/validation";
import styles from "@/components/ChatApplicationForm.module.css";

const FIRST_BANK_SIGNUP_URL = "https://openaccounts2.firstbanknigeria.com/corporate/";

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
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <AccountDetails applicationId={applicationId} />
    </Suspense>
  );
}

function AccountDetails({ applicationId }: { applicationId: string }) {
  const searchParams = useSearchParams();
  const isReturning = searchParams.get("returning") === "1";
  const referralToken = searchParams.get("token");

  const [status, setStatus] = useState<ContinuationStatus | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard API can fail silently; the code is still visible on screen */
    }
  }

  useEffect(() => {
    getContinuationStatus(applicationId).then(setStatus);
  }, [applicationId]);

  async function handleSubmit() {
    if (!accountNumber.trim() || !accountName.trim()) {
      setError("Enter both your account number and account name.");
      return;
    }
    if (!isLikelyPersonName(accountName)) {
      setError(ACCOUNT_NAME_ERROR);
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
              {isReturning && (
                <div className={styles.statusCard} style={{ marginBottom: 16 }}>
                  <p className={styles.statusLabel}>Already registered</p>
                  <h2>You&rsquo;ve already registered — here&rsquo;s your application.</h2>
                </div>
              )}

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
                  <div className={styles.statusCard}>
                    <p className={styles.statusLabel}>Already applied</p>
                    <h2>You have already applied for this grant.</h2>
                    <p>
                      Your grant application has already been received. Your next step is to submit
                      your FirstBank SME account details below.
                    </p>
                  </div>

                  <div className={styles.codeBlock}>
                    <p className={styles.label}>Your Grant Code</p>
                    <p className={styles.code}>{status.grantCode}</p>
                  </div>
                  <div className={styles.rowActions} style={{ maxWidth: 320, margin: "12px auto 0" }}>
                    <button
                      className={`${styles.btn} ${styles.btnGhost}`}
                      style={{ flex: 1 }}
                      onClick={() => copyCode(status.grantCode)}
                    >
                      {copied ? "Copied ✓" : "Copy code"}
                    </button>
                  </div>
                  <p
                    style={{
                      maxWidth: 420,
                      margin: "14px auto 0",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#c0392b",
                    }}
                  >
                    PLEASE NOTE: Copy this Grant Code. You MUST enter this Grant Code in the
                    &ldquo;Additional Information&rdquo; field when opening your FirstBank SME account.
                  </p>

                  <div className={styles.warningBox} style={{ marginTop: 16 }}>
                    <b>Warning:</b> You must provide the FirstBank SME account issued to you
                    during the account opening process. Submitting any account other than your
                    official FirstBank SME account will result in automatic disqualification from
                    the grant program.
                  </div>

                  <a
                    href={FIRST_BANK_SIGNUP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    style={{ display: "block", textAlign: "center", maxWidth: 420, margin: "16px auto 0", textDecoration: "none" }}
                  >
                    Open FirstBank SME Account →
                  </a>

                  <div className={styles.composerInner} style={{ marginTop: 16 }}>
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
                        {submitting ? "Submitting…" : "Submit My FirstBank Account →"}
                      </button>
                    </div>
                    {error && <p className={styles.errorText}>{error}</p>}
                  </div>
                  {referralToken && (
                    <div style={{ textAlign: "center", marginTop: 16 }}>
                      <a href={`/apply/${referralToken}`} style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "underline" }}>
                        Not you, or think this is a mistake? Start again
                      </a>
                    </div>
                  )}
                </>
              )}

              {(status.accountDetailsSubmitted || submitted) && !status.isVerified && (
                <>
                  <div className={styles.statusCard}>
                    <p className={styles.statusLabel}>{submitted ? "Awaiting Verification" : status.verificationLabel}</p>
                    <h2>Your application has been received.</h2>
                    <p>
                      Your application is currently in <strong>Phase 2</strong> and your FirstBank SME
                      account is awaiting verification.
                    </p>
                    <p>
                      {submitted
                        ? "We've saved your account details and will verify them against FirstBank's records shortly."
                        : status.verificationDescription}
                    </p>
                  </div>
                  <a
                    href={FIRST_BANK_SIGNUP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.btn} ${styles.btnGhost}`}
                    style={{ display: "block", textAlign: "center", maxWidth: 420, margin: "12px auto 0", textDecoration: "none" }}
                  >
                    If you haven&rsquo;t opened your FirstBank SME account, click here to open one →
                  </a>
                </>
              )}

              {status.isVerified && (
                <div className={styles.statusCard}>
                  <p className={styles.statusLabel}>Verified</p>
                  <h2>You have been verified. 🎉</h2>
                  <p>Your FirstBank SME account has been verified — Phase 2 is complete.</p>
                  <p>
                    Every three months, a random draw is conducted from all eligible, verified
                    applicants. Selected recipients are contacted directly and grants are disbursed.
                    There&rsquo;s nothing more for you to do — just watch for that contact.
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
