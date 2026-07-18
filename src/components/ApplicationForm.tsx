"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { recordVisit, submitApplication } from "@/app/apply/[token]/actions";
import { GRANT_CATEGORIES, DRAW_INFO, type GrantTier } from "@/lib/grantCategories";
import { getGrantQuestions, DECLARATION_TEXT, type GrantQuestion } from "@/lib/grantQuestions";
import type { GrantCategoryId } from "@/lib/types";
import styles from "@/components/ChatApplicationForm.module.css";

type FieldValue = string | number | boolean | null;
type Answers = Record<string, FieldValue>;

interface TranscriptItem {
  who: "bot" | "user";
  text: string;
}

type Stage = "category" | "questions" | "summary" | "submitting" | "done";

function required(q: GrantQuestion): boolean {
  return q.required ?? true;
}

function fname(answers: Answers): string {
  const v = answers.applicantName;
  return typeof v === "string" && v.trim() ? v.trim().split(/\s+/)[0]! : "there";
}

interface Props {
  token: string;
  referralResolved: boolean;
}

interface SavedDraft {
  categoryId: GrantCategoryId;
  answers: Answers;
  qIndex: number;
  transcript: TranscriptItem[];
  stage: Stage;
  savedAt: number;
}

export default function ApplicationForm({ token }: Props) {
  const [stage, setStage] = useState<Stage>("category");
  const [categoryId, setCategoryId] = useState<GrantCategoryId | null>(null);
  const [questions, setQuestions] = useState<GrantQuestion[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [qIndex, setQIndex] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [typing, setTyping] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [grantCode, setGrantCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<SavedDraft | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const draftKey = `gt_application_draft_${token}`;

  useEffect(() => {
    recordVisit(token).catch(() => {
      /* non-fatal — the token in the URL still works at submit time */
    });
  }, [token]);

  // Look for a saved draft on this device so the applicant can pick up where
  // they left off, even after closing the tab or reloading.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed: SavedDraft = JSON.parse(raw);
        if (parsed && parsed.categoryId && parsed.transcript?.length > 0 && parsed.stage !== "done") {
          setDraft(parsed);
        }
      }
    } catch {
      /* corrupt or unavailable storage — just start fresh */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave on every change. Nothing to persist before a category's picked;
  // clear the draft entirely once actually submitted.
  useEffect(() => {
    if (stage === "category" && !categoryId) return;
    try {
      if (stage === "done") {
        window.localStorage.removeItem(draftKey);
      } else if (categoryId) {
        const payload: SavedDraft = { categoryId, answers, qIndex, transcript, stage, savedAt: Date.now() };
        window.localStorage.setItem(draftKey, JSON.stringify(payload));
      }
    } catch {
      /* localStorage may be unavailable — the session still works, it just won't resume after reload */
    }
  }, [categoryId, answers, qIndex, transcript, stage, draftKey]);

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [transcript, typing, qIndex, stage]);

  const category = categoryId ? GRANT_CATEGORIES.find((c) => c.id === categoryId)! : null;

  function resumeDraft() {
    if (!draft) return;
    const cat = GRANT_CATEGORIES.find((c) => c.id === draft.categoryId);
    if (!cat) return;
    setCategoryId(draft.categoryId);
    setQuestions(getGrantQuestions(cat.tier));
    setAnswers(draft.answers);
    setQIndex(draft.qIndex);
    setTranscript(draft.transcript);
    setStage(draft.stage);
    setDraft(null);
  }

  function startFresh() {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setDraft(null);
  }

  function selectCategory(id: GrantCategoryId, tier: GrantTier) {
    const qs = getGrantQuestions(tier);
    setCategoryId(id);
    setQuestions(qs);
    setStage("questions");
    setQIndex(0);
    askQuestion(0, qs);
  }

  function askQuestion(idx: number, qs: GrantQuestion[]) {
    const q = qs[idx];
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setTranscript((t) => [...t, { who: "bot", text: q.question }]);
    }, 450 + Math.random() * 300);
  }

  function submitAnswer(id: string, value: FieldValue, display: string) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setTranscript((t) => [...t, { who: "user", text: display }]);
    const nextIndex = qIndex + 1;
    setQIndex(nextIndex);

    if (nextIndex >= questions.length) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setStage("summary");
        setTranscript((t) => [
          ...t,
          { who: "bot", text: `That's everything, ${fname(answers)}. Take a look below, then send it in when you're ready.` },
        ]);
      }, 450 + Math.random() * 300);
    } else {
      askQuestion(nextIndex, questions);
    }
  }

  function goBack() {
    if (stage === "summary") {
      setTranscript((t) => t.slice(0, -1));
      setStage("questions");
      return;
    }
    if (stage === "questions") {
      if (qIndex === 0) {
        setStage("category");
        setTranscript([]);
        setQIndex(0);
        setCategoryId(null);
        setAnswers({});
        return;
      }
      setTranscript((t) => t.slice(0, -2));
      setQIndex((i) => i - 1);
    }
  }

  async function finalSubmit() {
    if (!category) return;
    setStage("submitting");
    setSubmitError(null);

    const res = await submitApplication({
      token,
      honeypot,
      grantCategory: category.id,
      grantAmount: category.amount,
      applicantName: typeof answers.applicantName === "string" ? answers.applicantName : "",
      phone: typeof answers.phone === "string" ? answers.phone : "",
      email: typeof answers.email === "string" ? answers.email : "",
      stateOfResidence: typeof answers.stateOfResidence === "string" ? answers.stateOfResidence : "",
      businessName: typeof answers.businessName === "string" ? answers.businessName : "",
      grantNeedExplanation: typeof answers.grantNeedExplanation === "string" ? answers.grantNeedExplanation : "",
      businessType: typeof answers.businessType === "string" ? answers.businessType : undefined,
      businessLocation: typeof answers.businessLocation === "string" ? answers.businessLocation : undefined,
      monthlyProductCost: typeof answers.monthlyProductCost === "number" ? answers.monthlyProductCost : undefined,
      cacNumber: typeof answers.cacNumber === "string" ? answers.cacNumber : undefined,
      businessDescription: typeof answers.businessDescription === "string" ? answers.businessDescription : undefined,
      declarationAgreed: answers.declarationAgreed === "accepted",
    });

    if (!res.ok) {
      setSubmitError(res.error ?? "Something went wrong. Please try again.");
      setStage("summary");
      return;
    }
    setGrantCode(res.grantCode ?? null);
    setStage("done");
  }

  async function copyCode() {
    if (!grantCode) return;
    try {
      await navigator.clipboard.writeText(grantCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard API can fail silently; the code is still visible on screen */
    }
  }

  const progressPct =
    stage === "category"
      ? 0
      : stage === "questions"
        ? 5 + (qIndex / Math.max(questions.length, 1)) * 89
        : stage === "summary" || stage === "submitting"
          ? 96
          : 100;

  const headerLabel = stage === "category" ? "Choose a grant" : category ? category.name : "Application";

  return (
    <div className={styles.page}>
      <div className={styles.app}>
        <header className={styles.header}>
          <button
            className={styles.backBtn}
            onClick={goBack}
            disabled={stage === "category" || stage === "done" || stage === "submitting"}
            title="Back"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className={styles.mark}>
            <Image src="/logo.png" alt="Globe-Tech" width={34} height={34} className={styles.markImg} priority />
          </div>
          <div className={styles.headText}>
            <div className={styles.org}>Globe-Tech · SME Grant Program</div>
            <div className={styles.roleLabel}>{headerLabel}</div>
          </div>
        </header>
        <div style={{ padding: "0 20px" }}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className={styles.thread}>
          {stage === "category" && draft && (
            <div className={styles.welcomeHero}>
              <h1>Welcome back — we can continue from where you stopped.</h1>
              <p>Your progress on this device was saved automatically.</p>
            </div>
          )}

          {stage === "category" && !draft && (
            <>
              <div className={styles.welcomeHero}>
                <h1>Which grant fits your business?</h1>
                <p>
                  Read through the options below, then pick the one that matches your business.
                  We&rsquo;ll only ask what&rsquo;s relevant to your choice — about 10 quick
                  questions either way.
                </p>
              </div>

              <div className={styles.categoryGrid}>
                {GRANT_CATEGORIES.map((c) => (
                  <button key={c.id} className={styles.categoryCard} onClick={() => selectCategory(c.id, c.tier)}>
                    <div>
                      <div style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 16, color: "var(--text)" }}>
                        {c.name}
                      </div>
                      <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.4 }}>{c.coversWho}</div>
                    </div>
                    <div style={{ flexShrink: 0, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, fontSize: 15, color: "var(--gold)", whiteSpace: "nowrap" }}>
                      ₦{c.amount.toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>

              <div className={styles.drawInfo}>
                <p className={styles.drawTitle}>How the draw works</p>
                <ul>
                  {DRAW_INFO.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {stage !== "category" &&
            transcript.map((item, i) => (
              <div key={i} className={`${styles.row} ${item.who === "bot" ? styles.rowBot : styles.rowUser}`}>
                {item.who === "bot" && <div className={styles.avatar}>GT</div>}
                <div className={`${styles.bubble} ${item.who === "bot" ? styles.botBubble : styles.userBubble}`}>{item.text}</div>
                {item.who === "user" && <div className={`${styles.avatar} ${styles.userAvatar}`}>{fname(answers).charAt(0).toUpperCase()}</div>}
              </div>
            ))}

          {typing && (
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div className={styles.avatar}>GT</div>
              <div className={`${styles.bubble} ${styles.botBubble} ${styles.typingBubble}`}>
                <div className={styles.dot} />
                <div className={styles.dot} />
                <div className={styles.dot} />
              </div>
            </div>
          )}

          {(stage === "summary" || stage === "submitting") && !typing && category && (
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div className={styles.avatar}>GT</div>
              <div className={styles.summaryCard}>
                <span className={styles.roleTag}>
                  {category.name} · ₦{category.amount.toLocaleString()}
                </span>
                {questions
                  .filter((q) => q.type !== "checkbox")
                  .map((q) => (
                    <div key={q.id} className={styles.sumRow}>
                      <div className={styles.sumK}>{q.label}</div>
                      <div className={styles.sumV}>
                        {q.type === "number"
                          ? answers[q.id]
                            ? `₦${Number(answers[q.id]).toLocaleString()}`
                            : "—"
                          : (answers[q.id] as string) || "—"}
                      </div>
                    </div>
                  ))}
                <div className={styles.sumRow}>
                  <div className={styles.sumK}>Declaration</div>
                  <div className={styles.sumV}>{answers.declarationAgreed === "accepted" ? "Agreed ✓" : "Not yet"}</div>
                </div>
              </div>
            </div>
          )}

          {stage === "done" && category && (
            <div className={styles.doneScreen}>
              <div className={styles.doneBadge}>✓</div>
              <h2>You&rsquo;re in, {fname(answers)}.</h2>
              <p>
                Your application for the <strong>{category.name}</strong> (₦{category.amount.toLocaleString()}) has
                been received. Recipients are chosen by random draw each quarter, so there&rsquo;s nothing more to
                do on that front. Check your email for the next step — opening your FirstBank account — we&rsquo;ve
                sent a full walkthrough to <strong>{answers.email as string}</strong>. Enter the code below in the{" "}
                <strong>Additional Information</strong> box on FirstBank&rsquo;s account-opening form.
              </p>
              <div className={styles.codeBlock}>
                <p className={styles.label}>Your Grant Code</p>
                <p className={styles.code}>{grantCode}</p>
              </div>
              <div className={styles.rowActions} style={{ maxWidth: 320, margin: "20px auto 0" }}>
                <button className={`${styles.btn} ${styles.btnGhost}`} style={{ flex: 1 }} onClick={copyCode}>
                  {copied ? "Copied ✓" : "Copy code"}
                </button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className={styles.composer}>
          {stage === "category" && draft && (
            <div className={styles.composerInner}>
              <div className={styles.rowActions}>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={startFresh}>
                  Start over
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={resumeDraft}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {stage === "questions" && !typing && questions[qIndex] && (
            <Composer key={qIndex} q={questions[qIndex]!} onAnswer={submitAnswer} />
          )}

          {stage === "summary" && !typing && (
            <div className={styles.composerInner}>
              {submitError && (
                <p className={styles.errorText} style={{ marginBottom: 10 }}>
                  {submitError}
                </p>
              )}
              <div className={styles.rowActions}>
                <button
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => {
                    setQIndex(0);
                    setStage("questions");
                    askQuestion(0, questions);
                  }}
                >
                  ← Edit answers
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={finalSubmit}>
                  Submit application →
                </button>
              </div>
            </div>
          )}

          {stage === "submitting" && (
            <div className={styles.composerInner}>
              <p className={styles.hint}>Submitting your application…</p>
            </div>
          )}
        </div>

        {/* Honeypot — visually hidden, never in the tab order, present throughout */}
        <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function Composer({ q, onAnswer }: { q: GrantQuestion; onAnswer: (id: string, value: FieldValue, display: string) => void }) {
  const isRequired = required(q);
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function attemptText(v: string) {
    const str = v.trim();
    if (isRequired && !str) {
      setError("This one's needed before we move on.");
      return;
    }
    if (q.type === "email" && str && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
      setError("That email doesn't look quite right — mind checking it?");
      return;
    }
    if (q.type === "tel" && str) {
      const digits = str.replace(/\D/g, "");
      if (digits.length !== 11) {
        setError("Enter exactly 11 digits.");
        return;
      }
      onAnswer(q.id, digits, digits);
      return;
    }
    if (q.type === "number") {
      const n = Number(str);
      if (isRequired && (!n || n <= 0)) {
        setError("Enter an amount greater than zero.");
        return;
      }
      onAnswer(q.id, n, n ? `₦${n.toLocaleString()}` : "—");
      return;
    }
    onAnswer(q.id, str || null, str || "—");
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && q.type !== "textarea") {
      e.preventDefault();
      attemptText(value);
    }
  }

  if (q.type === "select") {
    return (
      <div className={styles.composerInner}>
        <select ref={inputRef} className={styles.fieldSelect} value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="" disabled>
            Choose one…
          </option>
          {(q.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <div className={styles.rowActions}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => attemptText(value)}>
            Continue →
          </button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  if (q.type === "checkbox") {
    return (
      <div className={styles.composerInner}>
        <label className={styles.checkline}>
          <input type="checkbox" checked={declarationChecked} onChange={(e) => setDeclarationChecked(e.target.checked)} />
          <span>{DECLARATION_TEXT}</span>
        </label>
        <div className={styles.rowActions}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!declarationChecked}
            onClick={() => onAnswer(q.id, "accepted", "✓ Agreed")}
          >
            I agree, submit →
          </button>
        </div>
      </div>
    );
  }

  // text / email / tel / number / textarea
  return (
    <div className={styles.composerInner}>
      {q.type === "textarea" ? (
        <textarea ref={inputRef} className={styles.field} placeholder={q.placeholder} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} />
      ) : (
        <input
          ref={inputRef}
          className={styles.field}
          type={q.type === "number" ? "number" : q.type === "tel" ? "tel" : q.type}
          inputMode={q.type === "tel" ? "numeric" : undefined}
          placeholder={q.placeholder}
          value={value}
          onChange={(e) => setValue(q.type === "tel" ? e.target.value.replace(/\D/g, "").slice(0, 11) : e.target.value)}
          onKeyDown={handleKeyDown}
        />
      )}
      <div className={styles.rowActions}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => attemptText(value)}>
          Continue →
        </button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
