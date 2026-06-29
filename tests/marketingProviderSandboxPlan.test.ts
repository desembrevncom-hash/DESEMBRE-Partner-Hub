import { describe, it, expect } from "vitest";
import { getProviderSandboxPlan } from "../src/lib/marketing/providerSandboxPlan";

describe("M24 Provider Sandbox Credential Planning", () => {
  it("should never contain secret-looking substrings in any value except allowed env names", () => {
    const plans = getProviderSandboxPlan();
    const secretKeywords = ["sk-", "key_", "token", "password", "secret_value"];

    plans.forEach((plan) => {
      // Mock must be dry_run_only
      if (plan.provider === "mock") {
        expect(plan.setup_status).toBe("dry_run_only");
        expect(plan.production_gate_required).toBe(false);
      } else {
        expect(plan.setup_status).toBe("pending_sandbox_setup");
        expect(plan.production_gate_required).toBe(true);
      }

      const checkString = (str: string) => {
        const lowerStr = str.toLowerCase();
        secretKeywords.forEach((keyword) => {
          expect(lowerStr).not.toContain(keyword);
        });
      };

      checkString(plan.display_name);
      checkString(plan.secret_owner_role);
      checkString(plan.setup_status);
      checkString(plan.allowed_test_recipient_policy);
      plan.safety_notes.forEach(checkString);

      // Verify strict safe fields
      expect(plan.real_send_enabled).toBe(false);
      expect(plan.external_provider_calls_enabled).toBe(false);
    });
  });

  it("should list expected required env names without reading them", () => {
    const plans = getProviderSandboxPlan();
    
    const resend = plans.find((p) => p.provider === "resend");
    expect(resend).toBeDefined();
    expect(resend?.required_env_names).toContain("RESEND_API_KEY");
    expect(resend?.required_env_names).toContain("RESEND_SANDBOX_TO_ALLOWLIST");
    
    const zalo = plans.find((p) => p.provider === "zalo_zns");
    expect(zalo).toBeDefined();
    expect(zalo?.required_env_names).toContain("ZALO_ZNS_APP_ID");
    expect(zalo?.required_env_names).toContain("ZALO_ZNS_SECRET_KEY");
    expect(zalo?.required_env_names).toContain("ZALO_ZNS_SANDBOX_PHONE_ALLOWLIST");

    const mock = plans.find((p) => p.provider === "mock");
    expect(mock).toBeDefined();
    expect(mock?.required_env_names).toHaveLength(0);
  });
});
