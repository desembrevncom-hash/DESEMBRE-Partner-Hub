import { parseFacebookUrl } from "./src/lib/customers/facebookUrlParser";

console.log("=== facebookUrlParser Tests ===");

const cases = [
  "https://m.facebook.com/profile.php?id=1000847293&mibextid=123",
  "https://www.facebook.com/people/John-Doe/1000123456789/",
  "https://facebook.com/desembre.vn",
  "https://fb.com/groups/somegroup",
  "https://facebook.com/pages/business",
  "https://facebook.com/1000456789", // numeric username format
];

cases.forEach(c => {
  const parsed = parseFacebookUrl(c);
  console.log(`URL: ${c}`);
  console.log(`  UID: ${parsed.facebookUid}`);
  console.log(`  Username: ${parsed.facebookUsername}`);
  console.log(`  Normalized: ${parsed.normalizedUrl}`);
  console.log(`  isNumeric: ${parsed.isNumericUid}`);
  console.log('---');
});
