import { describe, it, expect } from "vitest";
import { runProviderConfigAudit } from "../src/lib/marketing/providerConfigAudit";

describe("M22 Provider Config Readiness Audit", () => {
  it("should never contain secret-looking substrings in any value except required_env_names", () => {
    const audit = runProviderConfigAudit();
    const secretKeywords = ["sk-", "key_", "secret", "token"];

    audit.forEach((result) => {
      // Check that status is not 'ready_for_real_send'
      expect(result.status).not.toBe("ready_for_real_send");

      // Mock must be ready_for_dry_run_only
      if (result.provider === "mock") {
        expect(result.status).toBe("ready_for_dry_run_only");
      }

      // Check all string fields to ensure no exposed secret values
      // Only 'required_env_names' is allowed to contain words like 'SECRET'
      const checkString = (str: string) => {
        const lowerStr = str.toLowerCase();
        secretKeywords.forEach((keyword) => {
          // "secret" is allowed inside the checklist as part of the sentence "Mock does not require any external secrets."
          // But "sk-", "key_" or something that looks like an actual token value should not be there.
          if (keyword === "secret" && lowerStr.includes("external secrets")) return;
          if (keyword === "secret" && lowerStr.includes("secret names documented")) return;
          
          expect(lowerStr).not.toContain(keyword);
        });
      };

      checkString(result.label);
      checkString(result.status);
      result.checklist.forEach(checkString);

      // Verify the strictly enforced safe fields
      expect(result.real_send_enabled).toBe(false);
      expect(result.external_provider_calls_enabled).toBe(false);
      expect(result.secrets_read).toBe(false);
      expect(result.secret_values_exposed).toBe(false);
      expect(result.provider_api_called).toBe(false);
    });
  });

  it("should list expected required env names for external providers", () => {
    const audit = runProviderConfigAudit();
    
    const resend = audit.find((a) => a.provider === "resend");
    expect(resend).toBeDefined();
    expect(resend?.required_env_names).toContain("RESEND_API_KEY");
    expect(resend?.required_env_names).toContain("RESEND_FROM_EMAIL");
    
    const zalo = audit.find((a) => a.provider === "zalo_zns");
    expect(zalo).toBeDefined();
    expect(zalo?.required_env_names).toContain("ZALO_ZNS_APP_ID");
    expect(zalo?.required_env_names).toContain("ZALO_ZNS_SECRET_KEY");
    expect(zalo?.required_env_names).toContain("ZALO_ZNS_OA_ID");

    const mock = audit.find((a) => a.provider === "mock");
    expect(mock).toBeDefined();
    expect(mock?.required_env_names).toHaveLength(0);
  });
});
