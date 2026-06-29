import { ProviderName, getSupportedProviderNames } from "./providers";

export interface SecretGateResult {
  provider_id: ProviderName;
  configured: boolean;
  checked_env_names: string[];
  missing_env_names: string[];
  secret_values_exposed: false;
  provider_api_called: false;
  real_send_enabled: false;
  external_provider_calls_enabled: false;
  production_gate_required: boolean;
}

export function checkProviderSecretGate(envPresence: Record<string, boolean>): SecretGateResult[] {
  return getSupportedProviderNames().map((providerName) => {
    switch (providerName) {
      case "mock":
        return {
          provider_id: "mock",
          configured: true,
          checked_env_names: [],
          missing_env_names: [],
          secret_values_exposed: false,
          provider_api_called: false,
          real_send_enabled: false,
          external_provider_calls_enabled: false,
          production_gate_required: false,
        };

      case "resend": {
        const required = [
          "RESEND_API_KEY",
          "RESEND_FROM_EMAIL",
          "RESEND_SANDBOX_TO_ALLOWLIST",
        ];
        const missing = required.filter((name) => !envPresence[name]);

        return {
          provider_id: "resend",
          configured: missing.length === 0,
          checked_env_names: required,
          missing_env_names: missing,
          secret_values_exposed: false,
          provider_api_called: false,
          real_send_enabled: false,
          external_provider_calls_enabled: false,
          production_gate_required: true,
        };
      }

      case "zalo_zns": {
        const required = [
          "ZALO_ZNS_APP_ID",
          "ZALO_ZNS_SECRET_KEY",
          "ZALO_ZNS_OA_ID",
          "ZALO_ZNS_SANDBOX_PHONE_ALLOWLIST",
        ];
        const missing = required.filter((name) => !envPresence[name]);

        return {
          provider_id: "zalo_zns",
          configured: missing.length === 0,
          checked_env_names: required,
          missing_env_names: missing,
          secret_values_exposed: false,
          provider_api_called: false,
          real_send_enabled: false,
          external_provider_calls_enabled: false,
          production_gate_required: true,
        };
      }
    }
  });
}
