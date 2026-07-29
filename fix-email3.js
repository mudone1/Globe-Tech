const fs = require("fs");
const path = require("path");

const p = path.join("src", "lib", "email.ts");
let text = fs.readFileSync(p, "utf8");
const hadCRLF = text.includes("\r\n");
const normalized = text.replace(/\r\n/g, "\n");

const oldStr = "                  You'll enter this in the <strong>Additional Information</strong> box at Step 6 below \\u2014 it's what\n                  links your new account to your grant application.\n                </p>\n              </td>\n            </tr>\n            ${stepsHtml}";

const newStr = "                  You'll enter this in the <strong>Additional Information</strong> box at Step 6 below \\u2014 it's what\n                  links your new account to your grant application.\n                </p>\n                <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">\n                  <tr><td align=\"center\">\n                    <a href=\"${FIRSTBANK_ACCOUNT_URL}\" style=\"display:inline-block;background:#C8952A;color:#1A1204;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;padding:13px 24px;border-radius:8px;text-decoration:none;\">\n                      Open my FirstBank Account \\u2192\n                    </a>\n                  </td></tr>\n                </table>\n              </td>\n            </tr>\n            ${stepsHtml}";

if (!normalized.includes(oldStr)) {
  console.log("❌ Still not found even with escaped unicode. Printing raw bytes for inspection:\n");
  const idx = normalized.indexOf("links your new account");
  console.log(JSON.stringify(normalized.slice(idx - 250, idx + 100)));
  process.exit(1);
}

let result = normalized.replace(oldStr, newStr);
if (hadCRLF) result = result.replace(/\n/g, "\r\n");
fs.writeFileSync(p, result, "utf8");
console.log("✅ Patched: add FirstBank CTA button to email in " + p);
