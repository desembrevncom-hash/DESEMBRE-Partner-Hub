import { describe, it, expect } from "vitest";
import { validateSegmentRules, evaluateCustomerAgainstSegment } from "../src/lib/marketing/segmentRules";
import { FilterRulesJson } from "../src/lib/marketing/types";

describe("Segment Rules Validator", () => {
  it("rejects invalid fields", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          { field: "invalid_field" as any, operator: "equals", value: "test" }
        ]
      }
    } as FilterRulesJson;
    expect(validateSegmentRules(rules)).toBe(false);
  });

  it("rejects invalid operators", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          { field: "stage", operator: "hack_db" as any, value: "test" }
        ]
      }
    } as FilterRulesJson;
    expect(validateSegmentRules(rules)).toBe(false);
  });

  it("rejects deep nesting > 2", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          {
            type: "OR",
            rules: [
              {
                type: "AND", // Depth 3
                rules: [
                  { field: "stage", operator: "equals", value: "test" }
                ]
              }
            ]
          }
        ]
      }
    } as any;
    expect(validateSegmentRules(rules)).toBe(false);
  });

  it("accepts valid rules", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          { field: "stage", operator: "equals", value: "VIP" },
          { field: "has_valid_phone", operator: "equals", value: true }
        ]
      }
    } as FilterRulesJson;
    expect(validateSegmentRules(rules)).toBe(true);
  });
});

describe("Segment Evaluator", () => {
  const customer = {
    id: "1",
    name: "John",
    stage: "VIP",
    phone: "0901234567", // Valid phone
    email: "john@example.com",
    facebook_uid: "123456789"
  };

  const fbCustomer = {
    id: "2",
    name: "FB Only",
    stage: "New",
    phone: "10070796168965", // FB UID masquerading as phone
    email: null
  };

  it("evaluates valid phone segment correctly", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          { field: "has_valid_phone", operator: "equals", value: true }
        ]
      }
    } as FilterRulesJson;
    
    expect(evaluateCustomerAgainstSegment(customer, rules)).toBe(true);
    expect(evaluateCustomerAgainstSegment(fbCustomer, rules)).toBe(false);
  });

  it("evaluates facebook UID but no valid phone correctly", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          { field: "phone_is_facebook_uid", operator: "equals", value: true }
        ]
      }
    } as FilterRulesJson;
    
    expect(evaluateCustomerAgainstSegment(customer, rules)).toBe(false);
    expect(evaluateCustomerAgainstSegment(fbCustomer, rules)).toBe(true);
  });

  it("evaluates combined AND filters", () => {
    const rules = {
      group: {
        type: "AND",
        rules: [
          { field: "stage", operator: "equals", value: "VIP" },
          { field: "has_email", operator: "equals", value: true }
        ]
      }
    } as FilterRulesJson;
    
    expect(evaluateCustomerAgainstSegment(customer, rules)).toBe(true);
    expect(evaluateCustomerAgainstSegment(fbCustomer, rules)).toBe(false);
  });

  it("evaluates combined OR filters", () => {
    const rules = {
      group: {
        type: "OR",
        rules: [
          { field: "stage", operator: "equals", value: "New" },
          { field: "has_email", operator: "equals", value: true }
        ]
      }
    } as FilterRulesJson;
    
    expect(evaluateCustomerAgainstSegment(customer, rules)).toBe(true); // Matches has_email
    expect(evaluateCustomerAgainstSegment(fbCustomer, rules)).toBe(true); // Matches stage = New
  });
});
