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

// Tier tab name -> the single-letter code used in the staffId format
// (GBT{sequence}{tierLetter}/{programCode}), per the build plan.
const TIER_TABS: Record<string, { letter: string; label: string }> = {
  "Regional Coordinator": { letter: "R", label: "Regional Coordinator" },
  "State Coordinator": { letter: "S", label: "State Coordinator" },
  "Marketing Officer": { letter: "M", label: "Marketing Officer" },
};

const PROGRAM_CODE = "115545925"; // fixed suffix seen in the existing ID format — confirm this is constant across all staff

/**
 * TODO before enabling: confirm the exact column headers in each tab of the
 * onboarding sheet. This assumes columns named Sequence, Full Name, Email,
 * Phone, State — adjust the `row[...]` indices below to match your sheet
 * once you share it.
 */
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

    for (const [tabName, tier] of Object.entries(TIER_TABS)) {
      const range = `${tabName}!A2:F`; // row 1 assumed to be headers
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = resp.data.values ?? [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const rowNumber = i + 2; // account for header row + 0-index

        // TODO: adjust these indices to match the real column order once confirmed.
        const [sequenceRaw, fullName, email, phone, state, activeRaw] = row;
        if (!sequenceRaw || !fullName) continue; // skip blank/incomplete rows

        const sequence = String(sequenceRaw).padStart(2, "0");
        const staffId = `GBT${sequence}${tier.letter}/${PROGRAM_CODE}`;

        await db.collection("staff").doc(staffId).set(
          {
            staffId,
            fullName,
            tier: tier.label,
            email: email ?? "",
            phone: phone ?? "",
            state: state ?? "",
            active: activeRaw ? String(activeRaw).toLowerCase() === "true" : true,
            sourceRow: rowNumber,
          },
          { merge: true }
        );

        await ensureTokenFor(staffId);
      }
    }
  }
);
