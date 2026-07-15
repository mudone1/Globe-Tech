import "server-only";
import { google } from "googleapis";
import { customAlphabet } from "nanoid";
import { getAdminDb } from "@/lib/firebase-admin";

const TOKEN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const generateToken = customAlphabet(TOKEN_ALPHABET, 8);

// Real tab names from the Globe-Tech onboarding sheet. Note "Regional Cord"
// is the actual tab name (not "Regional Coordinator") — the tier LABEL
// stored in each row's own "Tier" column is the full name; the tab name is
// just where we look for rows.
const TABS = ["Marketing Officer", "State Coordinator", "Regional Cord"];

/**
 * Finds a column's index by matching against a list of possible header
 * names (case-insensitive, trimmed). Handles the sheet's inconsistent
 * headers across tabs (e.g. "Phone No." vs "Phone No.(Whatsapp)") without
 * needing hardcoded column positions.
 */
function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => (h ?? "").trim().toLowerCase());
  for (const candidate of candidates) {
    const target = candidate.trim().toLowerCase();
    const idx = normalized.findIndex((h) => h === target);
    if (idx !== -1) return idx;
  }
  for (const candidate of candidates) {
    const target = candidate.trim().toLowerCase();
    const idx = normalized.findIndex((h) => h.includes(target));
    if (idx !== -1) return idx;
  }
  return -1;
}

async function getSheetsClient() {
  const email = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      "GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY are not set. Add them in Vercel's environment variables."
    );
  }
  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

async function ensureTokenFor(staffId: string): Promise<void> {
  const db = getAdminDb();
  const existing = await db.collection("linkTokens").where("staffId", "==", staffId).limit(1).get();
  if (!existing.empty) return;

  let token = generateToken();
  while ((await db.collection("linkTokens").doc(token).get()).exists) {
    token = generateToken();
  }
  await db.collection("linkTokens").doc(token).set({
    token,
    staffId,
    createdAt: new Date().toISOString(),
  });
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  tabsProcessed?: number;
  staffSynced?: number;
  warnings?: string[];
}

/**
 * Reads all three onboarding-sheet tabs and upserts the staff collection,
 * generating a referral token for any staff member who doesn't have one yet.
 * This is the Vercel-hosted replacement for the Cloud Functions scheduled
 * sync — same logic, just triggered manually (or by Vercel Cron) instead of
 * running automatically every 15 minutes, so it doesn't require Firebase's
 * Blaze plan.
 */
export async function syncStaffFromSheet(): Promise<SyncResult> {
  const sheetId = process.env.ONBOARDING_SHEET_ID;
  if (!sheetId) {
    return { ok: false, error: "ONBOARDING_SHEET_ID is not set in environment variables." };
  }

  const warnings: string[] = [];
  let staffSynced = 0;

  try {
    const sheets = await getSheetsClient();
    const db = getAdminDb();

    for (const tabName of TABS) {
      const range = `${tabName}!A1:ZZ`;
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
      const allRows = resp.data.values ?? [];
      if (allRows.length < 2) {
        warnings.push(`Tab "${tabName}" is empty or has no data rows — skipped.`);
        continue;
      }

      const headers = allRows[0]!;
      const col = {
        staffId: findColumn(headers, ["Staff Code"]),
        fullName: findColumn(headers, ["Full Name"]),
        tier: findColumn(headers, ["Tier"]),
        email: findColumn(headers, ["Email Address"]),
        phone: findColumn(headers, ["Phone No.(Whatsapp)", "Phone No."]),
        state: findColumn(headers, ["State of Residence"]),
        reportsToCode: findColumn(headers, ["Reports To Code"]),
        reportsToName: findColumn(headers, ["Reports To Name"]),
      };

      if (col.staffId === -1 || col.fullName === -1 || col.tier === -1) {
        warnings.push(
          `Tab "${tabName}" is missing a required column (Staff Code / Full Name / Tier) — skipped.`
        );
        continue;
      }

      const dataRows = allRows.slice(1);
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]!;
        const rowNumber = i + 2;

        const staffId = (row[col.staffId] ?? "").trim();
        const fullName = (row[col.fullName] ?? "").trim();
        // Rows without a Staff Code haven't been approved/assigned an ID yet — skip.
        if (!staffId || !fullName) continue;

        const tier = (row[col.tier] ?? "").trim();
        const email = col.email !== -1 ? (row[col.email] ?? "").trim() : "";
        const phone = col.phone !== -1 ? (row[col.phone] ?? "").trim() : "";
        const state = col.state !== -1 ? (row[col.state] ?? "").trim() : "";
        const reportsToCode =
          col.reportsToCode !== -1 ? (row[col.reportsToCode] ?? "").trim() : "";
        const reportsToName =
          col.reportsToName !== -1 ? (row[col.reportsToName] ?? "").trim() : "";

        await db.collection("staff").doc(staffId).set(
          {
            staffId,
            fullName,
            tier,
            email,
            phone,
            state,
            active: true,
            sourceRow: rowNumber,
            ...(reportsToCode ? { reportsToCode } : {}),
            ...(reportsToName ? { reportsToName } : {}),
          },
          { merge: true }
        );

        await ensureTokenFor(staffId);
        staffSynced++;
      }
    }

    return { ok: true, tabsProcessed: TABS.length, staffSynced, warnings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Sheet sync failed:", err);
    return { ok: false, error: message };
  }
}
