const fs = require("fs");
const content = fs.readFileSync("src/components/customers/CustomerPreviewDrawer.tsx", "utf8");
const lines = content.split("\n");

console.log("Searching showCheckinDialog in CustomerPreviewDrawer.tsx...");
lines.forEach((l, idx) => {
  if (l.includes("showCheckinDialog") || l.includes("checkinNote")) {
    console.log(`${idx + 1}: ${l.trim()}`);
  }
});
