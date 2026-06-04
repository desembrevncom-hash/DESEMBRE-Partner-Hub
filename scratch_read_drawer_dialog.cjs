const fs = require("fs");
const content = fs.readFileSync("src/components/customers/CustomerPreviewDrawer.tsx", "utf8");
const lines = content.split("\n");

console.log("CustomerPreviewDrawer.tsx lines 2210-2340:");
for (let i = 2209; i < 2340 && i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
