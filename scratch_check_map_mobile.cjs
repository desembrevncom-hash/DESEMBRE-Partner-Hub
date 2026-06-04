const fs = require("fs");
const content = fs.readFileSync("src/routes/customers/map.tsx", "utf8");
const lines = content.split("\n");

console.log("Searching mobile/lg/md responsive classes in map.tsx...");
lines.forEach((l, idx) => {
  if (
    l.includes("aside") ||
    l.includes("md:hidden") ||
    l.includes("lg:hidden") ||
    l.includes("block") ||
    (l.includes("hidden") && (l.includes("w-") || l.includes("h-")))
  ) {
    if (l.includes("aside") || l.includes("sidebar") || l.includes("mobile")) {
      console.log(`${idx + 1}: ${l.trim()}`);
    }
  }
});
