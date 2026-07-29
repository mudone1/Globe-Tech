const fs = require("fs");
const path = require("path");

const p = path.join("src", "app", "admin", "staff-code-migration", "page.tsx");
let text = fs.readFileSync(p, "utf8");
const hadCRLF = text.includes("\r\n");
let normalized = text.replace(/\r\n/g, "\n");

function replaceOnce(str, oldS, newS, label) {
  if (!str.includes(oldS)) {
    console.log(`❌ SKIPPED (${label}): pattern not found.`);
    return str;
  }
  console.log(`✅ Applied: ${label}`);
  return str.replace(oldS, newS);
}

normalized = replaceOnce(
  normalized,
  `import { previewMigration, executeMigration, resendNotifications, repairReferralLinks } from "./actions";`,
  `import { previewMigration, executeMigration, resendNotifications, repairReferralLinks, repairAuthClaims } from "./actions";`,
  "import repairAuthClaims"
);

normalized = replaceOnce(
  normalized,
  `import type { MigrationResult, ResendNotificationsResult, RepairReferralLinksResult } from "@/lib/staffCodeMigration";`,
  `import type { MigrationResult, ResendNotificationsResult, RepairReferralLinksResult, RepairAuthClaimsResult } from "@/lib/staffCodeMigration";`,
  "import RepairAuthClaimsResult type"
);

normalized = replaceOnce(
  normalized,
  `  const [repairResult, setRepairResult] = useState<RepairReferralLinksResult | null>(null);
  const [repairLoading, setRepairLoading] = useState(false);`,
  `  const [repairResult, setRepairResult] = useState<RepairReferralLinksResult | null>(null);
  const [repairLoading, setRepairLoading] = useState(false);
  const [authRepairResult, setAuthRepairResult] = useState<RepairAuthClaimsResult | null>(null);
  const [authRepairLoading, setAuthRepairLoading] = useState(false);`,
  "add authRepair state"
);

normalized = replaceOnce(
  normalized,
  `  const handleRepairLinks = async () => {
    setRepairLoading(true);
    setError(null);
    try {
      const data = await repairReferralLinks();
      setRepairResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repair failed");
    } finally {
      setRepairLoading(false);
    }
  };`,
  `  const handleRepairLinks = async () => {
    setRepairLoading(true);
    setError(null);
    try {
      const data = await repairReferralLinks();
      setRepairResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repair failed");
    } finally {
      setRepairLoading(false);
    }
  };

  const handleRepairAuthClaims = async () => {
    setAuthRepairLoading(true);
    setError(null);
    try {
      const data = await repairAuthClaims();
      setAuthRepairResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth claims repair failed");
    } finally {
      setAuthRepairLoading(false);
    }
  };`,
  "add handleRepairAuthClaims"
);

const oldSection = `          {repairResult && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-blue-700">Corrected Staff</p>
                  <p className="text-xl font-bold text-blue-900">{repairResult.totalCorrectedStaff}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Repaired</p>
                  <p className="text-xl font-bold text-blue-900">{repairResult.tokensRepaired}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Already OK</p>
                  <p className="text-xl font-bold text-blue-900">{repairResult.tokensAlreadyOk}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">No Link Found</p>
                  <p className="text-xl font-bold text-blue-900">{repairResult.tokensMissing}</p>
                </div>
              </div>
              {repairResult.errors.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-red-600">
                  {repairResult.errors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>`;

const newSection = `          {repairResult && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-blue-700">Corrected Staff</p>
                  <p className="text-xl font-bold text-blue-900">{repairResult.totalCorrectedStaff}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Repaired</p>
                  <p className="text-xl font-bold text-blue-900">{repairResult.tokensRepaired}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Already OK</p>
                  <p className="text-xl font-bold text-blue-900">{repairResult.tokensAlreadyOk}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">No Link Found</p>
                  <p className="text-xl font-bold text-blue-900">{repairResult.tokensMissing}</p>
                </div>
              </div>
              {repairResult.errors.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-red-600">
                  {repairResult.errors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Repair Auth Claims Section */}
        <div className="mt-8 bg-white rounded-lg border border-line p-6">
          <h2 className="text-xl font-bold text-ink">Repair Login (Auth Claims)</h2>
          <p className="mt-1 text-sm text-slate">
            Staff who received their new staff code email but can&apos;t log in are stuck because their
            login token still references their old, deleted staff code. This re-syncs their login
            credential to the corrected staff code — same password, no need to re-register.
          </p>
          <button
            onClick={handleRepairAuthClaims}
            disabled={authRepairLoading}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {authRepairLoading ? "Repairing..." : "Repair Login (Auth Claims)"}
          </button>

          {authRepairResult && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-blue-700">Corrected Staff</p>
                  <p className="text-xl font-bold text-blue-900">{authRepairResult.totalCorrectedStaff}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Repaired</p>
                  <p className="text-xl font-bold text-blue-900">{authRepairResult.repaired}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Skipped (no account yet)</p>
                  <p className="text-xl font-bold text-blue-900">{authRepairResult.skipped}</p>
                </div>
              </div>
              {authRepairResult.errors.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-red-600">
                  {authRepairResult.errors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>`;

normalized = replaceOnce(normalized, oldSection, newSection, "insert Repair Auth Claims section");

let result = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
fs.writeFileSync(p, result, "utf8");
console.log("\nDone writing " + p);
