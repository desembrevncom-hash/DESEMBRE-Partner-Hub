import { ProviderName } from "./providers";

export interface SandboxExecutionRequest {
  provider_id: ProviderName;
  channel: "email" | "zalo";
  recipient: string;
  requested_by_role: string;
  sandbox_mode_requested: boolean;
}

export interface SandboxExecutionControllerResult {
  provider_id: ProviderName;
  execution_allowed: boolean;
  execution_mode: "dry_run_only" | "mock_sandbox_executed" | "sandbox_blocked" | "production_blocked";
  provider_api_called: false;
  real_send_enabled: false;
  external_provider_calls_enabled: false;
  production_gate_open: false;
  recipient_allowed: boolean;
  approval_required: true;
  reasons: string[];
  synthetic_message_id?: string;
  provider_message_id: null;
}

function isMockRecipientAllowed(channel: "email" | "zalo", recipient: string): boolean {
  if (channel === "email") {
    // Only allow clearly internal/synthetic test email
    return recipient.endsWith("@desembre.vn") || recipient.includes("test");
  } else {
    // Zalo/phone: only allow synthetic/internal test phone (starts with 000, etc., or specific format)
    // We will just do a dummy check for "000" or test format for mock.
    return recipient.startsWith("000") || recipient.includes("test");
  }
}

export function evaluateSandboxExecution(
  request: SandboxExecutionRequest
): SandboxExecutionControllerResult {
  const baseResult = {
    provider_id: request.provider_id,
    execution_allowed: false,
    provider_api_called: false as const,
    real_send_enabled: false as const,
    external_provider_calls_enabled: false as const,
    production_gate_open: false as const,
    approval_required: true as const,
    provider_message_id: null,
  };

  if (request.provider_id === "mock") {
    const allowed = isMockRecipientAllowed(request.channel, request.recipient);
    if (!allowed) {
      return {
        ...baseResult,
        execution_mode: "dry_run_only",
        recipient_allowed: false,
        reasons: ["Mock provider requires a valid synthetic/internal test recipient."],
      };
    }

    if (!request.sandbox_mode_requested) {
      return {
        ...baseResult,
        execution_mode: "dry_run_only",
        recipient_allowed: true,
        reasons: ["Sandbox mode was not explicitly requested. Executed as dry run."],
      };
    }

    // Mock execution allowed
    return {
      ...baseResult,
      execution_allowed: true,
      execution_mode: "mock_sandbox_executed",
      recipient_allowed: true,
      reasons: ["Mock sandbox execution successful."],
      synthetic_message_id: `mock-msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
  }

  if (request.provider_id === "resend") {
    return {
      ...baseResult,
      execution_mode: "sandbox_blocked",
      recipient_allowed: false,
      reasons: ["M27 Phase 1 explicitly blocks real Resend execution.", "Internal admin email allowlist policy applies but remains blocked in Phase 1."],
    };
  }

  if (request.provider_id === "zalo_zns") {
    return {
      ...baseResult,
      execution_mode: "sandbox_blocked",
      recipient_allowed: false,
      reasons: ["M27 Phase 1 explicitly blocks real Zalo ZNS execution.", "Internal admin phone allowlist policy applies but remains blocked in Phase 1."],
    };
  }

  // Fallback for safety
  return {
    ...baseResult,
    execution_mode: "production_blocked",
    recipient_allowed: false,
    reasons: ["Unknown provider. Blocked."],
  };
}
