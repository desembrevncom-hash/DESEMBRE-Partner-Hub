import { describe, it, expect } from "vitest";

// We will test the remaining logic of index.tsx that might crash on the bad row.
// The user's bad row:
const badRow = {
  name: 123456789012345,
  contact_name: null,
  business_name: 12345,
  facility_name: undefined,
  phone: 943597123,
  email: 12345,
  summary: 67890,
  notes: {},
  source: null,
  status: true,
  owner_sale_id: "sale-123",
  owner_tele_id: "tele-123",
  customer_social_profiles: [],
  social_profiles: [],
  id: "bad-row-123",
  created_at: new Date().toISOString(),
};

describe("Find the crash", () => {
  it("should not crash on saleName.split", () => {
    // Staff Map mock where a staff member's display_name might be a number
    const staffMap = {
      "sale-123": { display_name: 99999, email: "sale@ex.com" }
    };
    
    const customer = badRow;
    const saleName = staffMap[customer.owner_sale_id]?.display_name || staffMap[customer.owner_sale_id]?.email || "Sale";
    
    // This is how it's used in index.tsx:2133
    const result = saleName.split(" ")[0];
    console.log(result);
  });
});
