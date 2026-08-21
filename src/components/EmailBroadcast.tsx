"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { previewBroadcastRecipients, sendBroadcast, sendTestBroadcastEmail } from "@/app/admin/settings/broadcast-actions";
import { RECIPIENT_GROUP_IDS, RECIPIENT_GROUP_LABELS, type RecipientGroupId } from "@/lib/recipientGroups";

type Stage = "compose" | "preview" | "sent";

export default function EmailBroadcast() {
  const [group, setGroup] = useState<RecipientGroupId>("all_applicants");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [stage, setStage] = useState<Stage>("compose");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sentCount: number; failedCount: number } | null>(null);

  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);

  async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.access_token ?? null;
  }

  function backToCompose() {
    setStage("compose");
    setPreviewCount(null);
  }

  async function handlePreview() {
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError("Enter a subject and message first.");
      return;
    }
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) { setError("Your session has expired. Please sign in again."); return; }
      const res = await previewBroadcastRecipients(token, group);
      if (!res.ok) { setError(res.error); return; }
      setPreviewCount(res.count);
      setStage("preview");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    setError(null);
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) { setError("Your session has expired. Please sign in again."); return; }
      const res = await sendBroadcast(token, group, subject, body);
      if (!res.ok) { setError(res.error); return; }
      setResult({ sentCount: res.sentCount, failedCount: res.failedCount });
      setStage("sent");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTest() {
    setTestError(null);
    setTestSent(false);
    if (!subject.trim() || !body.trim()) {
      setTestError("Enter a subject and message first.");
      return;
    }
    setTestLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) { setTestError("Your session has expired. Please sign in again."); return; }
      const res = await sendTestBroadcastEmail(token, testEmail, subject, body);
      if (!res.ok) { setTestError(res.error); return; }
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } finally {
      setTestLoading(false);
    }
  }

  function reset() {
    setSubject(""); setBody(""); setPreviewCount(null); setResult(null); setError(null); setStage("compose");
  }

  return (
    <div className="card-rise rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-display text-base font-semibold text-ink">Email Broadcast</h2>
      <p className="mt-1 text-sm text-slate">
        Send an email to a group of applicants or staff. Recipient addresses are pulled automatically.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {stage === "sent" && result ? (
        <div className="mt-4 rounded-md bg-good/10 px-3 py-3 text-sm text-good">
          Sent to {result.sentCount} recipient{result.sentCount === 1 ? "" : "s"}.
          {result.failedCount > 0 && ` ${result.failedCount} failed — check the send log.`}
          <div className="mt-3">
            <button onClick={reset} className="btn-secondary text-sm">Send another</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Recipient group</span>
              <select
                className="input"
                value={group}
                disabled={stage === "preview"}
                onChange={(e) => { setGroup(e.target.value as RecipientGroupId); backToCompose(); }}
              >
                {RECIPIENT_GROUP_IDS.map((id) => (
                  <option key={id} value={id}>{RECIPIENT_GROUP_LABELS[id]}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Subject</span>
              <input
                className="input"
                value={subject}
                disabled={stage === "preview"}
                onChange={(e) => { setSubject(e.target.value); backToCompose(); }}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Message</span>
              <textarea
                className="input min-h-[160px]"
                value={body}
                disabled={stage === "preview"}
                onChange={(e) => { setBody(e.target.value); backToCompose(); }}
              />
            </label>
          </div>

          <div className="mt-5 rounded-md border border-line bg-paper px-3 py-3">
            <span className="mb-1.5 block text-sm font-medium text-ink">Send a test email</span>
            <p className="mb-2 text-xs text-slate">
              Sends the subject/message above to one address only, prefixed "[TEST]" — doesn't touch real recipients.
            </p>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="email"
                placeholder="you@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <button onClick={handleSendTest} disabled={testLoading || !testEmail.trim()} className="btn-secondary text-sm shrink-0">
                {testLoading ? "Sending…" : testSent ? "Sent ✓" : "Send test"}
              </button>
            </div>
            {testError && <p className="mt-2 text-xs text-bad">{testError}</p>}
          </div>

          {stage === "compose" && (
            <div className="mt-5">
              <button onClick={handlePreview} disabled={loading} className="btn-primary">
                {loading ? "Checking…" : "Preview recipients"}
              </button>
            </div>
          )}

          {stage === "preview" && previewCount !== null && (
            <div className="mt-5 rounded-md bg-goldSoft px-3 py-3 text-sm text-ink">
              This will send to <strong>{previewCount}</strong> recipient{previewCount === 1 ? "" : "s"} in{" "}
              <strong>{RECIPIENT_GROUP_LABELS[group]}</strong>.
              <div className="mt-3 flex gap-2">
                <button onClick={backToCompose} className="btn-secondary text-sm">Edit</button>
                <button onClick={handleSend} disabled={loading || previewCount === 0} className="btn-primary text-sm">
                  {loading ? "Sending…" : `Send to ${previewCount} recipient${previewCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
