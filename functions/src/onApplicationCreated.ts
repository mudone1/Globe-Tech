import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineString } from "firebase-functions/params";
import { google } from "googleapis";
import { db } from "./admin";

/**
 * PHASE 3 — not active yet.
 *
 * This function is fully wired but will only run once you:
 *   1. Provide a Resend or SendGrid API key (RESEND_API_KEY)
 *   2. Verify a sender domain with that provider
 *   3. Create a blank backup Google Sheet and share edit access with the
 *      same service account used for the onboarding sync, then set
 *      APPLICATIONS_BACKUP_SHEET_ID
 *
 * Until then, deploy it if you like — it will simply fail gracefully and
 * log to emailLogs, which is safe, but nothing will be emailed to applicants.
 */

const resendApiKey = defineString("RESEND_API_KEY");
const backupSheetId = defineString("APPLICATIONS_BACKUP_SHEET_ID");
const sheetsServiceAccountEmail = defineString("GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL");
const sheetsPrivateKey = defineString("GOOGLE_SHEETS_PRIVATE_KEY");

async function sendPhase2Email(to: string, applicantName: string, referralCode: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Globe-Tech SME Grant <grants@globaltech.com>", // swap for your verified sender
      to,
      subject: "Your FirstBank referral code — next step",
      html: `
        <p>Hi ${applicantName},</p>
        <p>Your grant application has been received. Phase 2 is opening a FirstBank account.</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:2px;font-family:monospace;">${referralCode}</p>
        <p>Enter this code in the <strong>Referral</strong> field on FirstBank's account-opening form.</p>
      `,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend API error: ${res.status} ${await res.text()}`);
  }
}

async function appendToBackupSheet(row: (string | number)[]) {
  const auth = new google.auth.JWT({
    email: sheetsServiceAccountEmail.value(),
    key: sheetsPrivateKey.value().replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: backupSheetId.value(),
    range: "A:Z",
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

export const onApplicationCreated = onDocumentCreated(
  "applications/{applicationId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const app = snap.data();
    const applicationId = event.params.applicationId;

    let emailOk = true;
    let emailError: string | null = null;

    try {
      await sendPhase2Email(app.email, app.applicantName, app.firstBankReferralCode);
    } catch (err) {
      emailOk = false;
      emailError = err instanceof Error ? err.message : String(err);
      console.error(`Phase 2 email failed for ${applicationId}:`, emailError);
    }

    try {
      await appendToBackupSheet([
        applicationId,
        app.applicantName,
        app.email,
        app.phone,
        app.businessName,
        app.referredBy,
        app.createdAt,
      ]);
    } catch (err) {
      console.error(`Backup sheet append failed for ${applicationId}:`, err);
      // Non-fatal — the primary record already exists in Firestore.
    }

    await db.collection("emailLogs").add({
      applicationId,
      type: "phase2_instructions",
      sentAt: new Date().toISOString(),
      opened: false,
      clicked: false,
      ...(emailOk ? {} : { error: emailError }),
    });

    if (emailOk) {
      await snap.ref.update({ status: "phase2_email_sent" });
    }
  }
);
