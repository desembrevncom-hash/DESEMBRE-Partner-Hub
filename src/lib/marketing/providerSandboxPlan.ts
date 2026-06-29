import { ProviderName, getSupportedProviderNames } from "./providers";

export interface SandboxPlanResult {
  provider: ProviderName;
  display_name: string;
  sandbox_supported: boolean;
  required_env_names: string[];
  secret_owner_role: string;
  setup_status: "pending_sandbox_setup" | "dry_run_only";
  allowed_test_recipient_policy: string;
  production_gate_required: boolean;
  safety_notes: string[];
  real_send_enabled: false;
  external_provider_calls_enabled: false;
}

export function getProviderSandboxPlan(): SandboxPlanResult[] {
  return getSupportedProviderNames().map((providerName) => {
    switch (providerName) {
      case "mock":
        return {
          provider: "mock",
          display_name: "Mock Provider",
          sandbox_supported: true,
          required_env_names: [],
          secret_owner_role: "none",
          setup_status: "dry_run_only",
          allowed_test_recipient_policy: "Any test email (no external routing)",
          production_gate_required: false,
          safety_notes: [
            "Mock provider does not call external services.",
            "Synthetic message IDs are generated instantly.",
            "Completely safe for local and CI testing without credentials.",
          ],
          real_send_enabled: false,
          external_provider_calls_enabled: false,
        };

      case "resend":
        return {
          provider: "resend",
          display_name: "Resend Email",
          sandbox_supported: true,
          required_env_names: [
            "RESEND_API_KEY",
            "RESEND_FROM_EMAIL",
            "RESEND_SANDBOX_TO_ALLOWLIST",
          ],
          secret_owner_role: "super_admin",
          setup_status: "pending_sandbox_setup",
          allowed_test_recipient_policy: "Only strictly allowlisted admin emails",
          production_gate_required: true,
          safety_notes: [
            "Resend sandbox requires strict recipient allowlisting.",
            "API keys must be securely injected, never hardcoded.",
            "Real execution logic is explicitly disabled pending production gate.",
          ],
          real_send_enabled: false,
          external_provider_calls_enabled: false,
        };

      case "zalo_zns":
        return {
          provider: "zalo_zns",
          display_name: "Zalo ZNS",
          sandbox_supported: true,
          required_env_names: [
            "ZALO_ZNS_APP_ID",
            "ZALO_ZNS_SECRET_KEY",
            "ZALO_ZNS_OA_ID",
            "ZALO_ZNS_SANDBOX_PHONE_ALLOWLIST",
          ],
          secret_owner_role: "super_admin",
          setup_status: "pending_sandbox_setup",
          allowed_test_recipient_policy: "Only strictly allowlisted admin phone numbers",
          production_gate_required: true,
          safety_notes: [
            "Zalo ZNS testing requires Zalo App review and sandbox allowlisting.",
            "Secret keys must be securely injected, never hardcoded.",
            "Real execution logic is explicitly disabled pending production gate.",
          ],
          real_send_enabled: false,
          external_provider_calls_enabled: false,
        };
    }
  });
}
