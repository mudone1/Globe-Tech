const fs = require("fs");
const path = require("path");

const p = path.join("src", "components", "ApplicationForm.tsx");
let text = fs.readFileSync(p, "utf8");
const hadCRLF = text.includes("\r\n");
const normalized = text.replace(/\r\n/g, "\n");

const oldStr = `              </div>
              
                href="https://openaccounts2.firstbanknigeria.com/corporate/"`;

const newStr = `              </div>
              
                href="https://openaccounts2.firstbanknigeria.com/corporate/"`;

if (!normalized.includes(oldStr)) {
  console.log("❌ Not found — printing exact region for manual inspection:");
  const idx = normalized.indexOf('href="https://openaccounts2');
  console.log(JSON.stringify(normalized.slice(idx - 150, idx + 100)));
  process.exit(1);
}

let result = normalized.replace(oldStr, newStr);
if (hadCRLF) result = result.replace(/\n/g, "\r\n");
fs.writeFileSync(p, result, "utf8");
console.log("✅ Fixed: restored missing <a> tag in " + p);
