const fs = require("fs");
const path = require("path");

const p = path.join("src", "lib", "selfRegistration.ts");
let text = fs.readFileSync(p, "utf8");
const hadCRLF = text.includes("\r\n");
const normalized = text.replace(/\r\n/g, "\n");

const oldFn = `async function generateStaffCode(tier: string, letter: string): Promise<string> {
  const db = getAdminDb();
  const countSnap = await db.collection("staff").where("tier", "==", tier).count().get();
  const seq = String(countSnap.data().count + 1).padStart(2, "0");

  // Use fixed suffix for all new staff codes
  const fixedSuffix = "115545925";
  const candidate = \`GBT\${seq}\${letter}/\${fixedSuffix}\`;

  // Verify this code doesn't already exist (collision check)
  const existing = await db.collection("staff").doc(staffDocId(candidate)).get();
  if (!existing.exists) return candidate;

  // If collision occurs (extremely unlikely), throw error with helpful message
  throw new Error(
    \`Staff code collision: \${candidate} already exists. This should be vanishingly rare. \` +
    \`Contact an administrator if you see this error.\`
  );
}`;

const newFn = `async function generateStaffCode(tier: string, letter: string): Promise<string> {
  const db = getAdminDb();
  const countSnap = await db.collection("staff").where("tier", "==", tier).count().get();
  let seqNum = countSnap.data().count + 1;

  // Use fixed suffix for all new staff codes
  const fixedSuffix = "115545925";

  // Retry with incrementing sequence numbers in case of a collision \u2014
  // the count-based sequence isn't guaranteed collision-free (e.g. after
  // a migration deletes/recreates records, or two signups land at once).
  for (let attempts = 0; attempts < 50; attempts++) {
    const seq = String(seqNum).padStart(2, "0");
    const candidate = \`GBT\${seq}\${letter}/\${fixedSuffix}\`;
    const existing = await db.collection("staff").doc(staffDocId(candidate)).get();
    if (!existing.exists) return candidate;
    seqNum++;
  }

  throw new Error(
    \`Couldn't generate a unique staff code for tier "\${tier}" after 50 attempts. Contact an administrator.\`
  );
}`;

if (!normalized.includes(oldFn)) {
  console.log("❌ generateStaffCode pattern not found — printing region for inspection:");
  const idx = normalized.indexOf("async function generateStaffCode");
  console.log(JSON.stringify(normalized.slice(idx, idx + 600)));
  process.exit(1);
}

let result = normalized.replace(oldFn, newFn);

// Wrap the simplified registration's call site in try/catch
const oldCallSite = `  const staffId = await generateStaffCode("Marketing Officer", "M");
  const now = new Date().toISOString();

  const record: StaffRecord = {
    staffId,
    fullName,
    tier: "Marketing Officer",`;

const newCallSite = `  let staffId: string;
  try {
    staffId = await generateStaffCode("Marketing Officer", "M");
  } catch (err) {
    console.error("registerNewStaffSimplified: staff code generation failed:", err);
    return { ok: false, error: "Something went wrong creating your account. Please try again in a moment." };
  }
  const now = new Date().toISOString();

  const record: StaffRecord = {
    staffId,
    fullName,
    tier: "Marketing Officer",`;

if (!result.includes(oldCallSite)) {
  console.log("⚠️  Function retry logic patched, but call-site try/catch pattern not found — skipping that part. Printing region:");
  const idx = result.indexOf('generateStaffCode("Marketing Officer"');
  console.log(JSON.stringify(result.slice(idx - 50, idx + 300)));
} else {
  result = result.replace(oldCallSite, newCallSite);
  console.log("✅ Wrapped registerNewStaffSimplified's generateStaffCode call in try/catch");
}

if (hadCRLF) result = result.replace(/\n/g, "\r\n");
fs.writeFileSync(p, result, "utf8");
console.log("✅ Patched: generateStaffCode retry logic in " + p);
