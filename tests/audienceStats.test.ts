import { describe, it, expect } from "vitest";
import { getAudienceStats } from "../src/lib/marketing/segmentRules";
import { FilterRulesJson } from "../src/lib/marketing/types";

describe("Audience Stats Generator", () => {
  const customers = [
    {
      id: "1",
      name: "John",
      stage: "VIP",
      phone: "0901234567", // Valid phone
      email: "john@example.com",
      facebook_uid: "123456789"
    },
    {
      id: "2",
      name: "FB Only",
      stage: "New",
      phone: "10070796168965", // FB UID masquerading as phone
      email: null
    },
    {
      id: "3",
      name: "No Contact",
      stage: "Recovery",
      phone: null,
      email: null
    }
  ];

  it("calculates audience stats correctly for valid phone segment", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          { field: "has_valid_phone", operator: "equals", value: true }
        ]
      }
    } as FilterRulesJson;
    
    const stats = getAudienceStats(customers, rules);
    
    expect(stats.total_customers).toBe(3);
    expect(stats.matched_customers).toBe(1);
    expect(stats.callable_count).toBe(1);
    expect(stats.email_count).toBe(1); // Since John matches and has email
    expect(stats.facebook_count).toBe(1); // Since John matches and has UID
    expect(stats.missing_phone_count).toBe(0);
  });

  it("calculates stats for data cleanup required", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          { field: "phone_is_facebook_uid", operator: "equals", value: true }
        ]
      }
    } as FilterRulesJson;
    
    const stats = getAudienceStats(customers, rules);
    
    expect(stats.matched_customers).toBe(1);
    expect(stats.callable_count).toBe(0);
    expect(stats.missing_phone_count).toBe(1);
    expect(stats.data_quality_issue_count).toBe(1);
    expect(stats.skipped_reasons).toHaveProperty("Phone contains Facebook UID");
  });

  it("calculates stats for unassigned", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          { field: "UNASSIGNED", operator: "equals", value: true }
        ]
      }
    } as FilterRulesJson;
    
    const stats = getAudienceStats(customers, rules);
    
    // All 3 have no owner_sale_id/owner_tele_id, so they should match
    expect(stats.matched_customers).toBe(3);
    expect(stats.unassigned_count).toBe(3);
  });
});
