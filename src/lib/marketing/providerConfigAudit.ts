import { ProviderName, getSupportedProviderNames } from "./providers";

export type AuditStatus = "ready_for_dry_run_only" | "config_pending";

export interface ProviderConfigAuditResult {
  provider: ProviderName;
  label: string;
  channel: "email" | "zalo";
  status: AuditStatus;
  required_env_names: string[];
  real_send_enabled: false;
  external_provider_calls_enabled: false;
  secrets_read: false;
  secret_values_exposed: false;
  provider_api_called: false;
  checklist: string[];
}

export function runProviderConfigAudit(): ProviderConfigAuditResult[] {
  return getSupportedProviderNames().map((providerName) => {
    switch (providerName) {
      case "mock":
        return {
          provider: "mock",
          label: "Mock Provider",
          channel: "email",
          status: "ready_for_dry_run_only",
          required_env_names: [],
          real_send_enabled: false,
          external_provider_calls_enabled: false,
          secrets_read: false,
          secret_values_exposed: false,
          provider_api_called: false,
          checklist: [
            "Mock adapter configuration verified.",
            "Mock does not require any external secrets.",
            "Mock does not make any external provider API calls.",
            "Mock is ready for dry validation only.",
          ],
        };

      case "resend":
        return {
          provider: "resend",
          label: "Resend Email",
          channel: "email",
          status: "config_pending",
          required_env_names: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
          real_send_enabled: false,
          external_provider_calls_enabled: false,
          secrets_read: false,
          secret_values_exposed: false,
          provider_api_called: false,
          checklist: [
            "Resend requires external configuration.",
            "Required secret names documented but values are completely hidden.",
            "Real send is explicitly disabled by design.",
            "External provider API calls are explicitly disabled by design.",
            "Config remains pending until explicit future production gate.",
          ],
        };

      case "zalo_zns":
        return {
          provider: "zalo_zns",
          label: "Zalo ZNS",
          channel: "zalo",
          status: "config_pending",
          required_env_names: ["ZALO_ZNS_APP_ID", "ZALO_ZNS_SECRET_KEY", "ZALO_ZNS_OA_ID"],
          real_send_enabled: false,
          external_provider_calls_enabled: false,
          secrets_read: false,
          secret_values_exposed: false,
          provider_api_called: false,
          checklist: [
            "Zalo ZNS requires external configuration.",
            "Required secret names documented but values are completely hidden.",
            "Real send is explicitly disabled by design.",
            "External provider API calls are explicitly disabled by design.",
            "Config remains pending until explicit future production gate.",
          ],
        };
    }
  });
}
