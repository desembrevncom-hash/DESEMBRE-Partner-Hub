const fs = require("fs");
const content = fs.readFileSync("src/components/customers/CustomerPreviewDrawer.tsx", "utf8");
const lines = content.split("\n");

console.log("Searching customer_visit_checkins in CustomerPreviewDrawer.tsx...");
lines.forEach((l, idx) => {
  if (l.includes("customer_visit_checkins")) {
    console.log(`${idx + 1}: ${l.trim()}`);
  }
});
