import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import { google } from "googleapis";
import { customAlphabet } from "nanoid";
import { db } from "./admin";

const onboardingSheetId = defineString("ONBOARDING_SHEET_ID");
const sheetsServiceAccountEmail = defineString("GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL");
const sheetsPrivateKey = defineString("GOOGLE_SHEETS_PRIVATE_KEY");

const TOKEN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const generateToken = customAlphabet(TOKEN_ALPHABET, 8);

// Real tab names from the Globe-Tech onboarding sheet. Note "Regional Cord"
// is the actual tab name (not "Regional Coordinator") — the tier LABEL
// stored in each row's "Tier" column is the full name; the tab name is
// just where we look for rows.
const TABS = ["Marketing Officer", "State Coordinator", "Regional Cord"];

/**
 * Finds a column's index by matching against a list of possible header
 * names (case-insensitive, trimmed). Handles the sheet's inconsistent
 * headers across tabs (e.g. "Phone No." vs "Phone No.(Whatsapp)") without
 * needing hardcoded column positions, which would break if columns are
 * ever reordered or a tab's headers drift from another's.
 */
function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => (h ?? "").trim().toLowerCase());
  for (const candidate of candidates) {
    const target = candidate.trim().toLowerCase();
    const idx = normalized.findIndex((h) => h === target);
    if (idx !== -1) return idx;
  }
  // Fall back to a partial match (e.g. "Phone No." matches "Phone No.(Whatsapp)")
  for (const candidate of candidates) {
    const target = candidate.trim().toLowerCase();
    const idx = normalized.findIndex((h) => h.includes(target));
    if (idx !== -1) return idx;
  }
  return -1;
}

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: sheetsServiceAccountEmail.value(),
    key: sheetsPrivateKey.value().replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

async function ensureTokenFor(staffId: string) {
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

export const syncOnboardingSheet = onSchedule(
  { schedule: "every 15 minutes", timeZone: "Africa/Lagos" },
  async () => {
    const sheets = await getSheetsClient();
    const spreadsheetId = onboardingSheetId.value();

    for (const tabName of TABS) {
      // Pull the whole tab (header row included) rather than assuming a
      // fixed range — some tabs have 19 columns, others 25.
      const range = `${tabName}!A1:ZZ`;
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const allRows = resp.data.values ?? [];
      if (allRows.length < 2) continue; // header only, or empty tab

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
        console.error(
          `Tab "${tabName}" is missing an expected column (Staff Code / Full Name / Tier) — skipping this tab. Found headers: ${headers.join(" | ")}`
        );
        continue;
      }

      const dataRows = allRows.slice(1);
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]!;
        const rowNumber = i + 2; // account for header row + 0-index

        const staffId = (row[col.staffId] ?? "").trim();
        const fullName = (row[col.fullName] ?? "").trim();
        // Rows without a Staff Code haven't been approved/assigned an ID yet
        // (matches the sheet's own "Not approved" count) — skip them rather
        // than creating a broken staff record with no ID.
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
      }
    }
  }
);
