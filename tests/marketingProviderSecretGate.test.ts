import { describe, it, expect } from "vitest";
import { checkProviderSecretGate } from "../src/lib/marketing/providerSecretGate";
import { readFileSync } from "fs";
import { join } from "path";

describe("M25 Provider Sandbox Secret Gate", () => {
  it("should mark mock as configured without any env", () => {
    const results = checkProviderSecretGate({});
    const mock = results.find((r) => r.provider_id === "mock");
    expect(mock).toBeDefined();
    expect(mock?.configured).toBe(true);
    expect(mock?.missing_env_names).toHaveLength(0);
  });

  it("should mark resend/zalo as missing when env dict is empty", () => {
    const results = checkProviderSecretGate({});
    const resend = results.find((r) => r.provider_id === "resend");
    const zalo = results.find((r) => r.provider_id === "zalo_zns");

    expect(resend?.configured).toBe(false);
    expect(resend?.missing_env_names).toContain("RESEND_API_KEY");
    expect(resend?.missing_env_names).toContain("RESEND_FROM_EMAIL");
    expect(resend?.missing_env_names).toContain("RESEND_SANDBOX_TO_ALLOWLIST");

    expect(zalo?.configured).toBe(false);
    expect(zalo?.missing_env_names).toContain("ZALO_ZNS_APP_ID");
    expect(zalo?.missing_env_names).toContain("ZALO_ZNS_SECRET_KEY");
    expect(zalo?.missing_env_names).toContain("ZALO_ZNS_OA_ID");
    expect(zalo?.missing_env_names).toContain("ZALO_ZNS_SANDBOX_PHONE_ALLOWLIST");
  });

  it("should mark resend as configured only when all required names exist", () => {
    // Missing one
    let results = checkProviderSecretGate({
      RESEND_API_KEY: "dummy",
      RESEND_FROM_EMAIL: "dummy",
    });
    let resend = results.find((r) => r.provider_id === "resend");
    expect(resend?.configured).toBe(false);
    expect(resend?.missing_env_names).toContain("RESEND_SANDBOX_TO_ALLOWLIST");

    // All present
    results = checkProviderSecretGate({
      RESEND_API_KEY: "dummy",
      RESEND_FROM_EMAIL: "dummy",
      RESEND_SANDBOX_TO_ALLOWLIST: "dummy",
    });
    resend = results.find((r) => r.provider_id === "resend");
    expect(resend?.configured).toBe(true);
    expect(resend?.missing_env_names).toHaveLength(0);
  });

  it("should mark zalo as configured only when all required names exist", () => {
    // Missing one
    let results = checkProviderSecretGate({
      ZALO_ZNS_APP_ID: "dummy",
      ZALO_ZNS_SECRET_KEY: "dummy",
      ZALO_ZNS_OA_ID: "dummy",
    });
    let zalo = results.find((r) => r.provider_id === "zalo_zns");
    expect(zalo?.configured).toBe(false);
    expect(zalo?.missing_env_names).toContain("ZALO_ZNS_SANDBOX_PHONE_ALLOWLIST");

    // All present
    results = checkProviderSecretGate({
      ZALO_ZNS_APP_ID: "dummy",
      ZALO_ZNS_SECRET_KEY: "dummy",
      ZALO_ZNS_OA_ID: "dummy",
      ZALO_ZNS_SANDBOX_PHONE_ALLOWLIST: "dummy",
    });
    zalo = results.find((r) => r.provider_id === "zalo_zns");
    expect(zalo?.configured).toBe(true);
    expect(zalo?.missing_env_names).toHaveLength(0);
  });

  it("should strictly enforce safe flags and ensure no secret values are returned", () => {
    const dummyEnv = {
      RESEND_API_KEY: "sk-super-secret-key-do-not-expose",
      ZALO_ZNS_SECRET_KEY: "zalo-token-do-not-expose",
    };
    
    const results = checkProviderSecretGate(dummyEnv);

    results.forEach((result) => {
      expect(result.secret_values_exposed).toBe(false);
      expect(result.provider_api_called).toBe(false);
      expect(result.real_send_enabled).toBe(false);
      expect(result.external_provider_calls_enabled).toBe(false);

      // Verify dummy values never leaked into the result strings
      const resultStr = JSON.stringify(result).toLowerCase();
      expect(resultStr).not.toContain("sk-");
      expect(resultStr).not.toContain("token");
      expect(resultStr).not.toContain("do-not-expose");
    });
  });

  it("helper source code should not contain unsafe API or env calls", () => {
    const sourceCode = readFileSync(
      join(__dirname, "../src/lib/marketing/providerSecretGate.ts"),
      "utf8"
    );

    expect(sourceCode).not.toContain("import.meta.env");
    expect(sourceCode).not.toContain("process.env");
    expect(sourceCode).not.toContain("Deno.env");
    expect(sourceCode).not.toContain("fetch(");
    // Note: We only check the helper since the Edge function uses Deno.env legally server-side
  });
});
