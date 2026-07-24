/**
 * One-off backfill: sets `homeAddress` on each staff/{staffId} Firestore doc
 * from a CSV export (staffId,tier,fullName,address) — e.g. staff-addresses.csv
 * pulled from the Regional Application Form responses sheet.
 *
 * Now that onboarding no longer goes through the Google Sheets sync, this is
 * meant as a one-time (or occasional) manual top-up: rerun it whenever you
 * export a fresh sheet and want to push updated addresses into Firestore.
 *
 * SAFE BY DEFAULT: running with no flags only prints what WOULD change.
 * Nothing is written until you pass --apply.
 *
 * Usage:
 *   node scripts/backfillAddresses.mjs scripts/staff-addresses.csv            (dry run)
 *   node scripts/backfillAddresses.mjs scripts/staff-addresses.csv --apply    (writes to Firestore)
 *
 * Requires the same service account key the app already uses in .env.local:
 *   FIREBASE_SERVICE_ACCOUNT_KEY  — the full service account JSON as one line
 * This script reads it straight out of .env.local automatically — no need to
 * export it yourself (avoids Windows/PowerShell quoting issues). Just run
 * the script from the project root, where .env.local lives. You can still
 * set FIREBASE_SERVICE_ACCOUNT_KEY as a real env var instead if you prefer
 * (e.g. in CI) — it's checked first.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const csvPath = process.argv[2];
const apply = process.argv.includes("--apply");

if (!csvPath) {
  console.error("Usage: node scripts/backfillAddresses.mjs <path-to-csv> [--apply]");
  process.exit(1);
}

// Mirrors src/lib/staffId.ts — Firestore doc IDs can't contain "/".
function staffDocId(staffId) {
  return staffId.trim().replace(/\//g, "_");
}

// Minimal CSV parser — handles double-quote-wrapped fields, including ones
// containing commas or embedded newlines (a couple of the addresses in this
// export span two lines), which a naive line-by-line split would break on.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  const header = nonEmpty[0];
  return nonEmpty.slice(1).map((cells) => {
    const obj = {};
    header.forEach((h, idx) => (obj[h] = cells[idx] ?? ""));
    return obj;
  });
}

// Reads FIREBASE_SERVICE_ACCOUNT_KEY from a real env var if set, otherwise
// pulls it straight out of .env.local in the current working directory —
// this sidesteps Windows/PowerShell/CMD quoting issues entirely, since
// nothing has to survive being retyped or copy-pasted into a shell.
function loadServiceAccountRaw() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return { raw: process.env.FIREBASE_SERVICE_ACCOUNT_KEY, source: "environment variable" };
  }

  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set, and no .env.local was found at " +
        envPath +
        ".\nRun this script from your project root (the folder containing .env.local)."
    );
    process.exit(1);
  }

  const text = readFileSync(envPath, "utf-8");
  const keyMatch = text.match(/^FIREBASE_SERVICE_ACCOUNT_KEY\s*=\s*/m);
  if (!keyMatch) {
    console.error("Couldn't find FIREBASE_SERVICE_ACCOUNT_KEY in .env.local.");
    process.exit(1);
  }

  // Find where the value starts, right after "=".
  let i = keyMatch.index + keyMatch[0].length;
  while (i < text.length && /\s/.test(text[i]) && text[i] !== "{") i++;

  if (text[i] !== "{") {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_KEY in .env.local doesn't start with '{' — expected the raw " +
        "service account JSON right after the '='."
    );
    process.exit(1);
  }

  // Scan forward from the opening "{" to its matching closing "}", tracking
  // brace depth and skipping over anything inside quoted strings (so braces
  // that happen to appear inside string values don't throw off the count).
  // This correctly captures the JSON however it's wrapped across lines —
  // pretty-printed across many lines, or all on one line. Along the way, any
  // literal line break found INSIDE a string (most often the private_key
  // field, which should contain the two characters "\n" but sometimes ends
  // up with a real line break after being pasted through an editor) gets
  // converted back into a proper escaped "\n" so the result is valid JSON.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let out = "";
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        out += ch;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        out += ch;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
    }
    out += ch;
    if (depth === 0 && ch === "}") {
      i++;
      break;
    }
  }

  if (depth !== 0) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY in .env.local has an unmatched '{' — the JSON looks incomplete.");
    process.exit(1);
  }

  return { raw: out, source: ".env.local" };
}

function getAdminApp() {
  const { raw, source } = loadServiceAccountRaw();

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (err) {
    const openBraces = (raw.match(/{/g) || []).length;
    const closeBraces = (raw.match(/}/g) || []).length;
    const quotes = (raw.match(/"/g) || []).length;
    console.error(
      `Couldn't parse the service account key from ${source} as JSON.\n` +
        "Open .env.local and confirm FIREBASE_SERVICE_ACCOUNT_KEY= is followed by the " +
        "full JSON object, starting with { and ending with }.\n" +
        `Parse error: ${err.message}\n\n` +
        "Diagnostics (no key contents shown):\n" +
        `  extracted length: ${raw.length} characters\n` +
        `  starts with '{': ${raw.startsWith("{")}\n` +
        `  ends with '}': ${raw.trimEnd().endsWith("}")}\n` +
        `  '{' count: ${openBraces}, '}' count: ${closeBraces} (should be equal)\n` +
        `  '"' count: ${quotes} (should be even)`
    );
    process.exit(1);
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return initializeApp({ credential: cert(serviceAccount) });
}

const SCRIPT_VERSION = "v3-multiline-env-parser";

async function main() {
  console.log(`backfillAddresses.mjs ${SCRIPT_VERSION}`);
  const rows = parseCsv(readFileSync(csvPath, "utf-8")).filter((r) => r.staffId && r.address);
  console.log(`Loaded ${rows.length} rows from ${csvPath}.`);
  console.log(apply ? "Mode: APPLY (will write to Firestore)\n" : "Mode: DRY RUN (nothing will be written — pass --apply to write)\n");

  const db = getFirestore(getAdminApp());

  let toUpdate = 0;
  let alreadyCurrent = 0;
  let notFound = [];
  const batch = db.batch();

  for (const row of rows) {
    const docId = staffDocId(row.staffId);
    const ref = db.collection("staff").doc(docId);
    const snap = await ref.get();

    if (!snap.exists) {
      notFound.push(row.staffId);
      continue;
    }

    const current = snap.data().homeAddress || "";
    if (current.trim() === row.address.trim()) {
      alreadyCurrent++;
      continue;
    }

    toUpdate++;
    console.log(
      `${row.staffId} (${row.fullName || "?"}): ${current ? `"${current}"` : "(none)"} -> "${row.address}"`
    );
    if (apply) {
      batch.set(ref, { homeAddress: row.address }, { merge: true });
    }
  }

  if (apply && toUpdate > 0) {
    await batch.commit();
  }

  console.log("\n--- Summary ---");
  console.log(`Rows in CSV:        ${rows.length}`);
  console.log(`Updated:             ${apply ? toUpdate : `${toUpdate} (would update — rerun with --apply)`}`);
  console.log(`Already up to date:  ${alreadyCurrent}`);
  console.log(`No matching staff doc (skipped): ${notFound.length}`);
  if (notFound.length > 0) {
    console.log("  " + notFound.join(", "));
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
