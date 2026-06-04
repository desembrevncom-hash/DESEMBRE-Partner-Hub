const fs = require("fs");
const content = fs.readFileSync("src/components/customers/CustomerPreviewDrawer.tsx", "utf8");
const lines = content.split("\n");

console.log("CustomerPreviewDrawer.tsx lines 1325-1355:");
for (let i = 1324; i < 1355 && i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
