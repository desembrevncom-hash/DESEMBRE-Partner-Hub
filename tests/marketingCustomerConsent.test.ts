import { describe, it, expect } from "vitest";
import { evaluateCustomerConsent, CustomerMarketingPreferences } from "../src/lib/marketing/evaluateCustomerConsent";

describe("Marketing Customer Consent Logic (M39.2)", () => {
  it("should fail closed and block if preference row is missing", () => {
    const result = evaluateCustomerConsent("email", null);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_PREFERENCES");
  });

  it("should block all channels if global_opt_out is true", () => {
    const prefs: CustomerMarketingPreferences = {
      customer_id: "c1",
      email_opt_in: true,
      zalo_opt_in: true,
      global_opt_out: true
    };
    
    const emailResult = evaluateCustomerConsent("email", prefs);
    const zaloResult = evaluateCustomerConsent("zalo", prefs);
    
    expect(emailResult.allowed).toBe(false);
    expect(emailResult.code).toBe("GLOBAL_OPT_OUT");
    
    expect(zaloResult.allowed).toBe(false);
    expect(zaloResult.code).toBe("GLOBAL_OPT_OUT");
  });

  it("should allow email if opted in and no global opt out", () => {
    const prefs: CustomerMarketingPreferences = {
      customer_id: "c1",
      email_opt_in: true,
      zalo_opt_in: false,
      global_opt_out: false
    };
    
    const result = evaluateCustomerConsent("email", prefs);
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("CONSENT_GRANTED");
  });

  it("should block email if opted out", () => {
    const prefs: CustomerMarketingPreferences = {
      customer_id: "c1",
      email_opt_in: false,
      zalo_opt_in: true,
      global_opt_out: false
    };
    
    const result = evaluateCustomerConsent("email", prefs);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("EMAIL_OPT_OUT");
  });

  it("should allow zalo if opted in and no global opt out", () => {
    const prefs: CustomerMarketingPreferences = {
      customer_id: "c1",
      email_opt_in: false,
      zalo_opt_in: true,
      global_opt_out: false
    };
    
    const result = evaluateCustomerConsent("zalo", prefs);
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("CONSENT_GRANTED");
  });

  it("should block zalo if opted out", () => {
    const prefs: CustomerMarketingPreferences = {
      customer_id: "c1",
      email_opt_in: true,
      zalo_opt_in: false,
      global_opt_out: false
    };
    
    const result = evaluateCustomerConsent("zalo", prefs);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("ZALO_OPT_OUT");
  });

  it("should block unknown channel", () => {
    const prefs: CustomerMarketingPreferences = {
      customer_id: "c1",
      email_opt_in: true,
      zalo_opt_in: true,
      global_opt_out: false
    };
    
    const result = evaluateCustomerConsent("sms", prefs);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("UNKNOWN_CHANNEL");
  });
});
