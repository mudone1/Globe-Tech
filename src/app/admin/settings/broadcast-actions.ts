"use server";

import { verifyAdminSession } from "@/lib/staffAuth";
import { resolveRecipients } from "@/lib/broadcast";
import { RECIPIENT_GROUP_LABELS, type RecipientGroupId } from "@/lib/recipientGroups";
import { sendBroadcastEmailBatch, buildBroadcastEmailHtml } from "@/lib/email";
import { getAdminSupabase } from "@/lib/supabase-admin";

const BATCH_SIZE = 100;

export type PreviewResult = { ok: true; count: number } | { ok: false; error: string };

export async function previewBroadcastRecipients(
  accessToken: string,
  groupId: RecipientGroupId
): Promise<PreviewResult> {
  const auth = await verifyAdminSession(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!RECIPIENT_GROUP_LABELS[groupId]) return { ok: false, error: "Unknown recipient group." };

  try {
    const recipients = await resolveRecipients(groupId);
    return { ok: true, count: recipients.length };
  } catch (err) {
    console.error("previewBroadcastRecipients failed:", err);
    return { ok: false, error: "Couldn't load recipients. Please try again." };
  }
}

export type SendBroadcastResult =
  | { ok: true; sentCount: number; failedCount: number }
  | { ok: false; error: string };

export async function sendBroadcast(
  accessToken: string,
  groupId: RecipientGroupId,
  subject: string,
  bodyText: string
): Promise<SendBroadcastResult> {
  const auth = await verifyAdminSession(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!RECIPIENT_GROUP_LABELS[groupId]) return { ok: false, error: "Unknown recipient group." };
  if (!subject.trim()) return { ok: false, error: "Enter a subject." };
  if (!bodyText.trim()) return { ok: false, error: "Enter a message." };

  let recipients: { email: string }[];
  try {
    recipients = await resolveRecipients(groupId);
  } catch (err) {
    console.error("sendBroadcast: recipient lookup failed:", err);
    return { ok: false, error: "Couldn't load recipients. Please try again." };
  }
  if (recipients.length === 0) return { ok: false, error: "No recipients found in this group." };

  const html = buildBroadcastEmailHtml(bodyText.trim());
  let sentCount = 0;
  let failedCount = 0;
  let lastError: string | undefined;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    try {
      await sendBroadcastEmailBatch({ recipients: chunk.map((r) => r.email), subject: subject.trim(), html });
      sentCount += chunk.length;
    } catch (err) {
      console.error("sendBroadcast: batch failed:", err);
      failedCount += chunk.length;
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const db = getAdminSupabase();
  await db.from("broadcast_logs").insert({
    subject: subject.trim(),
    recipient_group: groupId,
    recipient_count: recipients.length,
    sent_by: auth.session.uid,
    sent_at: new Date().toISOString(),
    ...(failedCount > 0
      ? { error: `${failedCount} of ${recipients.length} failed to send${lastError ? `: ${lastError}` : ""}` }
      : {}),
  });

  if (sentCount === 0) return { ok: false, error: "Failed to send to any recipients. Please try again." };
  return { ok: true, sentCount, failedCount };
}

export type SendTestResult = { ok: true } | { ok: false; error: string };

/**
 * Sends the composed subject/body to a single admin-typed address — for
 * confirming deliverability before sending to a real recipient group. Does
 * NOT touch resolveRecipients or broadcast_logs; entirely separate from a
 * real broadcast send.
 */
export async function sendTestBroadcastEmail(
  accessToken: string,
  email: string,
  subject: string,
  bodyText: string
): Promise<SendTestResult> {
  const auth = await verifyAdminSession(accessToken);
  if (!auth.ok) return { ok: false, error: auth.error };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!subject.trim()) return { ok: false, error: "Enter a subject." };
  if (!bodyText.trim()) return { ok: false, error: "Enter a message." };

  try {
    const html = buildBroadcastEmailHtml(bodyText.trim());
    await sendBroadcastEmailBatch({ recipients: [trimmedEmail], subject: `[TEST] ${subject.trim()}`, html });
    return { ok: true };
  } catch (err) {
    console.error("sendTestBroadcastEmail failed:", err);
    return { ok: false, error: "Couldn't send the test email. Please try again." };
  }
}
