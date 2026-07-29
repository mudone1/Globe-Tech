const fs = require("fs");
const path = require("path");

const p = path.join("src", "lib", "email.ts");
let text = fs.readFileSync(p, "utf8");
const normalized = text.replace(/\r\n/g, "\n");

const idx = normalized.indexOf("You'll enter this in the");
if (idx === -1) {
  console.log("❌ Anchor phrase not found at all. Searching for a looser match...");
  const idx2 = normalized.indexOf("enter this in the");
  console.log(JSON.stringify(normalized.slice(idx2 - 100, idx2 + 400)));
  process.exit(1);
}

console.log("Found anchor. Surrounding text:\n");
console.log(JSON.stringify(normalized.slice(idx - 100, idx + 400)));
