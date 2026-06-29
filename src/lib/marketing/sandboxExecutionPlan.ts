import { ProviderName, getSupportedProviderNames } from "./providers";

export interface ExecutionPlanResult {
  provider_id: ProviderName;
  current_execution_mode: "dry_run_only" | "sandbox_planned" | "sandbox_blocked" | "production_blocked" | "real_send";
  required_gates: string[];
  blocked_reason: string;
  allowed_recipient_policy: string;
  future_m27_requirements: string[];
  real_send_enabled: false;
  external_provider_calls_enabled: false;
  provider_api_called: false;
  production_gate_open: false;
}

export function getSandboxExecutionPlan(): ExecutionPlanResult[] {
  return getSupportedProviderNames().map((providerName) => {
    switch (providerName) {
      case "mock":
        return {
          provider_id: "mock",
          current_execution_mode: "dry_run_only",
          required_gates: [],
          blocked_reason: "Mock provider is structurally restricted to dry runs.",
          allowed_recipient_policy: "Synthetic recipient only",
          future_m27_requirements: ["No additional requirements for mock."],
          real_send_enabled: false,
          external_provider_calls_enabled: false,
          provider_api_called: false,
          production_gate_open: false,
        };

      case "resend":
        return {
          provider_id: "resend",
          current_execution_mode: "sandbox_blocked",
          required_gates: [
            "global_kill_switch must be OFF in future sandbox",
            "provider_secret_gate must pass in future M27",
            "admin approval required",
            "quota > 0"
          ],
          blocked_reason: "M26 blocks all real sandbox execution natively.",
          allowed_recipient_policy: "Internal admin email allowlist only",
          future_m27_requirements: [
            "Must pass strict M25 secret gate evaluation at runtime.",
            "Must restrict actual dispatch to isolated sandbox queues."
          ],
          real_send_enabled: false,
          external_provider_calls_enabled: false,
          provider_api_called: false,
          production_gate_open: false,
        };

      case "zalo_zns":
        return {
          provider_id: "zalo_zns",
          current_execution_mode: "sandbox_blocked",
          required_gates: [
            "global_kill_switch must be OFF in future sandbox",
            "provider_secret_gate must pass in future M27",
            "admin approval required",
            "quota > 0"
          ],
          blocked_reason: "M26 blocks all real sandbox execution natively.",
          allowed_recipient_policy: "Internal admin phone allowlist only",
          future_m27_requirements: [
            "Must pass strict M25 secret gate evaluation at runtime.",
            "Must restrict actual dispatch to isolated sandbox queues."
          ],
          real_send_enabled: false,
          external_provider_calls_enabled: false,
          provider_api_called: false,
          production_gate_open: false,
        };
    }
  });
}
