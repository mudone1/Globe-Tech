const fs = require("fs");
const path = require("path");

const p = path.join("src", "lib", "email.ts");
let text = fs.readFileSync(p, "utf8");
const hadCRLF = text.includes("\r\n");
const normalized = text.replace(/\r\n/g, "\n");

const oldStr = `                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#4B5B52;">
                  You'll enter this in the <strong>Additional Information</strong> box at Step 6 below — it's what
                  links your new account to your grant application.
                </p>
              </td>
            </tr>`;

const newStr = `                <p style="margin:8px 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#4B5B52;">
                  You'll enter this in the <strong>Additional Information</strong> box at Step 6 below — it's what
                  links your new account to your grant application.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr><td align="center">
                    <a href="\${FIRSTBANK_ACCOUNT_URL}" style="display:inline-block;background:#C8952A;color:#1A1204;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;padding:13px 24px;border-radius:8px;text-decoration:none;">
                      Open my FirstBank Account →
                    </a>
                  </td></tr>
                </table>
              </td>
            </tr>`;

if (!normalized.includes(oldStr)) {
  console.log("❌ Still not found. Printing the relevant area of the file so we can compare manually:\n");
  const idx = normalized.indexOf("Additional Information");
  console.log(JSON.stringify(normalized.slice(idx - 200, idx + 300)));
  process.exit(1);
}

let result = normalized.replace(oldStr, newStr);
if (hadCRLF) result = result.replace(/\n/g, "\r\n");
fs.writeFileSync(p, result, "utf8");
console.log("✅ Patched: add FirstBank CTA button to email in " + p);
