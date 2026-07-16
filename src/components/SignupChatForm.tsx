"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ROLE_CONFIGS, type SignupRole } from "@/lib/staffRoles";
import { getSignupQuestions, MOU_ITEMS, DECLARATION_TEXT, type SignupQuestion } from "@/lib/signupQuestions";
import { submitStaffRegistration, uploadIdCard } from "@/app/signup/register/actions";
import styles from "@/components/ChatApplicationForm.module.css";

type FieldValue = string | { url: string; fileName: string } | null;
type Answers = Record<string, FieldValue>;

interface TranscriptItem {
  who: "bot" | "user";
  text: string;
}

type Stage = "welcome" | "questions" | "summary" | "submitting" | "done" | "error";

function fname(answers: Answers): string {
  const v = answers.firstName;
  return typeof v === "string" && v.trim() ? v.trim() : "there";
}

function required(q: SignupQuestion): boolean {
  return q.required ?? true;
}

export default function SignupChatForm({ role }: { role: SignupRole }) {
  const config = ROLE_CONFIGS[role];
  const questions = useState(() => getSignupQuestions(role))[0];

  const [stage, setStage] = useState<Stage>("welcome");
  const [answers, setAnswers] = useState<Answers>({});
  const [mouChecked, setMouChecked] = useState<boolean[]>(() => MOU_ITEMS.map(() => false));
  const [qIndex, setQIndex] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [typing, setTyping] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ staffId: string; setupToken: string; pendingApproval: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [transcript, typing, qIndex, stage]);

  function askQuestion(idx: number) {
    const q = questions[idx];
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setTranscript((t) => [...t, { who: "bot", text: q.question + (required(q) ? "" : " (optional)") }]);
    }, 450 + Math.random() * 300);
  }

  function start() {
    setStage("questions");
    setQIndex(0);
    askQuestion(0);
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
        setTranscript((t) => [...t, { who: "bot", text: `That's everything, ${fname(answers)}. Take a look below, then send it in when you're ready.` }]);
      }, 450 + Math.random() * 300);
    } else {
      askQuestion(nextIndex);
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
        setStage("welcome");
        setTranscript([]);
        setQIndex(0);
        return;
      }
      setTranscript((t) => t.slice(0, -2));
      setQIndex((i) => i - 1);
    }
  }

  async function finalSubmit() {
    setStage("submitting");
    setSubmitError(null);
    const idCard = answers.idCard as { url: string; fileName: string } | null;
    const res = await submitStaffRegistration({
      role,
      fullName: [answers.firstName, answers.middleName, answers.lastName]
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .join(" "),
      middleName: typeof answers.middleName === "string" ? answers.middleName : undefined,
      email: typeof answers.email === "string" ? answers.email : "",
      phone: typeof answers.phone === "string" ? answers.phone : "",
      state: typeof answers.state === "string" ? answers.state : "",
      homeAddress: typeof answers.homeAddress === "string" ? answers.homeAddress : "",
      socialMediaPlatform: typeof answers.socialMediaPlatform === "string" ? answers.socialMediaPlatform : undefined,
      socialMediaUsername: typeof answers.socialMediaUsername === "string" ? answers.socialMediaUsername : undefined,
      idCardUrl: idCard?.url,
      idCardFileName: idCard?.fileName,
      mouAccepted: mouChecked.every(Boolean),
      declarationAccepted: answers.declarationAccepted === "accepted",
      referrerCode: typeof answers.referrerCode === "string" ? answers.referrerCode : undefined,
      stateToCoordinate: typeof answers.stateToCoordinate === "string" ? answers.stateToCoordinate : undefined,
      roleSpecialization: typeof answers.roleSpecialization === "string" ? answers.roleSpecialization : undefined,
      stateOfInfluence: typeof answers.stateOfInfluence === "string" ? answers.stateOfInfluence : undefined,
    });

    if (!res.ok) {
      setSubmitError(res.error);
      setStage("summary");
      return;
    }
    setResult({ staffId: res.staffId, setupToken: res.setupToken, pendingApproval: res.pendingApproval });
    setStage("done");
  }

  async function copyCode() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.staffId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard API can fail silently; the code is still visible on screen */
    }
  }

  function downloadCode() {
    if (!result) return;
    const name = [answers.firstName, answers.lastName].filter(Boolean).join(" ");
    const blob = new Blob(
      [`Globe-Tech staff code\n\nName: ${name}\nRole: ${config.title}\nStaff code: ${result.staffId}\n`],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "globe-tech-staff-code.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const progressPct =
    stage === "welcome"
      ? 0
      : stage === "questions"
        ? 5 + (qIndex / Math.max(questions.length, 1)) * 89
        : stage === "summary" || stage === "submitting"
          ? 96
          : 100;

  const headerLabel = stage === "welcome" ? "Let's get you set up" : `${config.title} Signup`;

  return (
    <div className={styles.page}>
      <div className={styles.app}>
        <header className={styles.header}>
          <button
            className={styles.backBtn}
            onClick={goBack}
            disabled={stage === "welcome" || stage === "done" || stage === "submitting"}
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
            <div className={styles.org}>Globe-Tech · Staff Onboarding</div>
            <div className={styles.roleLabel}>{headerLabel}</div>
          </div>
        </header>
        <div style={{ padding: "0 20px" }}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className={styles.thread}>
          {stage === "welcome" && (
            <div className={styles.welcomeHero}>
              <h1>Hi — let&rsquo;s get you signed up as a {config.title}.</h1>
              <p>
                A few questions, one at a time, same as our grant application. Have your NIN or
                Voter&rsquo;s card ready for the ID check near the end.
              </p>
            </div>
          )}

          {stage !== "welcome" &&
            transcript.map((item, i) => (
              <div key={i} className={`${styles.row} ${item.who === "bot" ? styles.rowBot : styles.rowUser}`}>
                {item.who === "bot" && <div className={styles.avatar}>GT</div>}
                <div className={`${styles.bubble} ${item.who === "bot" ? styles.botBubble : styles.userBubble}`}>
                  {item.text}
                </div>
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

          {(stage === "summary" || stage === "submitting") && !typing && (
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div className={styles.avatar}>GT</div>
              <div className={styles.summaryCard}>
                <span className={styles.roleTag}>{config.title} Signup</span>
                {questions
                  .filter((q) => q.type !== "mou" && q.type !== "checkbox")
                  .map((q) => (
                    <div key={q.id} className={styles.sumRow}>
                      <div className={styles.sumK}>{q.label}</div>
                      <div className={styles.sumV}>
                        {q.id === "idCard"
                          ? (answers.idCard as { fileName: string } | null)?.fileName ?? "—"
                          : (answers[q.id] as string) || "—"}
                      </div>
                    </div>
                  ))}
                <div className={styles.sumRow}>
                  <div className={styles.sumK}>MOU acknowledged</div>
                  <div className={styles.sumV}>{mouChecked.every(Boolean) ? "Yes ✓" : "Incomplete"}</div>
                </div>
                <div className={styles.sumRow}>
                  <div className={styles.sumK}>Declaration</div>
                  <div className={styles.sumV}>{answers.declarationAccepted === "accepted" ? "Agreed ✓" : "Not yet"}</div>
                </div>
              </div>
            </div>
          )}

          {stage === "done" && result && (
            <div className={styles.doneScreen}>
              <div className={styles.doneBadge}>✓</div>
              <h2>You&rsquo;re signed up, {fname(answers)}.</h2>
              <p>
                {result.pendingApproval
                  ? "Your staff code is ready below. You can set your password now — you'll just need to wait for admin approval before you can log in."
                  : "Your staff code is ready below. Set your password next, then you're good to log in."}
              </p>
              <div className={styles.codeBlock}>
                <p className={styles.label}>Your staff code</p>
                <p className={styles.code}>{result.staffId}</p>
              </div>
              <div className={styles.rowActions} style={{ maxWidth: 360, margin: "16px auto 0" }}>
                <button className={`${styles.btn} ${styles.btnGhost}`} style={{ flex: 1 }} onClick={copyCode}>
                  {copied ? "Copied ✓" : "Copy code"}
                </button>
                <button className={`${styles.btn} ${styles.btnGhost}`} style={{ flex: 1 }} onClick={downloadCode}>
                  Download
                </button>
              </div>
              <Link
                href={`/signup/set-password?token=${result.setupToken}`}
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ maxWidth: 360, margin: "12px auto 0", display: "flex" }}
              >
                Continue to set your password →
              </Link>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className={styles.composer}>
          {stage === "welcome" && (
            <div className={styles.composerInner}>
              <div className={styles.rowActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={start}>
                  Let&rsquo;s go →
                </button>
              </div>
            </div>
          )}

          {stage === "questions" && !typing && questions[qIndex] && (
            <Composer
              key={qIndex}
              q={questions[qIndex]!}
              mouChecked={mouChecked}
              setMouChecked={setMouChecked}
              onAnswer={submitAnswer}
            />
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
                    askQuestion(0);
                  }}
                >
                  ← Edit answers
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={finalSubmit}>
                  Submit →
                </button>
              </div>
            </div>
          )}

          {stage === "submitting" && (
            <div className={styles.composerInner}>
              <p className={styles.hint}>Submitting your signup…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({
  q,
  mouChecked,
  setMouChecked,
  onAnswer,
}: {
  q: SignupQuestion;
  mouChecked: boolean[];
  setMouChecked: (v: boolean[]) => void;
  onAnswer: (id: string, value: FieldValue, display: string) => void;
}) {
  const isRequired = required(q);
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ url: string; fileName: string } | null>(null);
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
    if (q.type === "tel" && str && str.length !== 11) {
      setError("Enter exactly 11 digits.");
      return;
    }
    onAnswer(q.id, str || null, str || "—");
  }

  function skip() {
    onAnswer(q.id, null, "—");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadIdCard(formData);
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setUploaded({ url: res.url, fileName: res.fileName });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && q.type !== "textarea") {
      e.preventDefault();
      attemptText(value);
    }
  }

  if (q.type === "quickreply") {
    return (
      <div className={styles.composerInner}>
        <div className={styles.quickReplies}>
          {(q.options ?? []).map((o) => (
            <button key={o} className={styles.chip} onClick={() => onAnswer(q.id, o, o)}>
              {o}
            </button>
          ))}
        </div>
        {!isRequired && (
          <div className={styles.rowActions}>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={skip}>
              Skip
            </button>
          </div>
        )}
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
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

  if (q.type === "file") {
    return (
      <div className={styles.composerInner}>
        {!uploaded ? (
          <label className={styles.fileDrop}>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} />
            <span style={{ color: "var(--muted)", fontSize: 14 }}>
              {uploading ? "Uploading…" : "📎 Tap to choose your NIN or Voter's card (JPG, PNG, or PDF)"}
            </span>
          </label>
        ) : (
          <div className={styles.fileName}>
            <span>✓ {uploaded.fileName}</span>
            <button
              type="button"
              onClick={() => setUploaded(null)}
              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}
            >
              Replace
            </button>
          </div>
        )}
        <div className={styles.rowActions}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!uploaded}
            onClick={() => uploaded && onAnswer(q.id, uploaded, uploaded.fileName)}
          >
            Continue →
          </button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  if (q.type === "mou") {
    const allChecked = mouChecked.every(Boolean);
    return (
      <div className={styles.composerInner}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
          {MOU_ITEMS.map((item, i) => (
            <label key={i} className={styles.checkline}>
              <input
                type="checkbox"
                checked={mouChecked[i]}
                onChange={(e) => {
                  const next = [...mouChecked];
                  next[i] = e.target.checked;
                  setMouChecked(next);
                }}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
        <div className={styles.rowActions}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!allChecked}
            onClick={() => onAnswer(q.id, "accepted", `Acknowledged all ${MOU_ITEMS.length} MOU statements ✓`)}
          >
            Continue →
          </button>
        </div>
        {!allChecked && <p className={styles.hint}>Check all {MOU_ITEMS.length} statements to continue.</p>}
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
            I agree, continue →
          </button>
        </div>
      </div>
    );
  }

  // text / email / tel / textarea
  return (
    <div className={styles.composerInner}>
      {!isRequired && <div className={styles.hint}><b>Optional</b> — you can leave this blank and continue.</div>}
      {q.type === "textarea" ? (
        <textarea ref={inputRef} className={styles.field} placeholder={q.placeholder} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} />
      ) : (
        <input
          ref={inputRef}
          className={styles.field}
          type={q.type === "tel" ? "tel" : q.type}
          inputMode={q.type === "tel" ? "numeric" : undefined}
          placeholder={q.placeholder}
          value={value}
          onChange={(e) => setValue(q.type === "tel" ? e.target.value.replace(/\D/g, "").slice(0, 11) : e.target.value)}
          onKeyDown={handleKeyDown}
        />
      )}
      <div className={styles.rowActions}>
        {!isRequired && (
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={skip}>
            Skip
          </button>
        )}
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => attemptText(value)}>
          Continue →
        </button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
