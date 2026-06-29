export type ProviderName = "mock" | "resend" | "zalo_zns";

export interface ProviderResponse {
  success: boolean;
  provider_message_id?: string;
  error_code?: string;
  error_message?: string;
}

export interface MarketingProviderAdapter {
  sendMessage(payload: any): Promise<ProviderResponse>;
}

export interface ProviderDryValidationResult {
  provider: ProviderName;
  label: string;
  channel: "email" | "zalo";
  status: "pass" | "blocked";
  dry_run_only: true;
  real_send_enabled: false;
  can_initialize_adapter: boolean;
  checks: string[];
  warnings: string[];
}

export class MockProviderAdapter implements MarketingProviderAdapter {
  async sendMessage(payload: any): Promise<ProviderResponse> {
    // Mock only. No external HTTP request is made.
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      provider_message_id: `mock_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }
}

export class ResendAdapter implements MarketingProviderAdapter {
  async sendMessage(payload: any): Promise<ProviderResponse> {
    throw new Error("NotImplementedError: Real Resend calls are disabled in M19 dry validation.");
  }
}

export class ZaloZnsAdapter implements MarketingProviderAdapter {
  async sendMessage(payload: any): Promise<ProviderResponse> {
    throw new Error("NotImplementedError: Real Zalo ZNS calls are disabled in M19 dry validation.");
  }
}

export function getProviderAdapter(providerName: string): MarketingProviderAdapter {
  switch (providerName) {
    case "resend":
      return new ResendAdapter();
    case "zalo_zns":
      return new ZaloZnsAdapter();
    case "mock":
    default:
      return new MockProviderAdapter();
  }
}

export function getSupportedProviderNames(): ProviderName[] {
  return ["mock", "resend", "zalo_zns"];
}

export function dryValidateProviderAdapter(providerName: ProviderName): ProviderDryValidationResult {
  switch (providerName) {
    case "mock":
      return {
        provider: "mock",
        label: "Mock Provider",
        channel: "email",
        status: "pass",
        dry_run_only: true,
        real_send_enabled: false,
        can_initialize_adapter: true,
        checks: [
          "Mock adapter is available.",
          "Mock adapter does not require external secrets.",
          "Mock adapter does not call external provider APIs.",
        ],
        warnings: ["Mock provider creates synthetic message ids only."],
      };

    case "resend":
      return {
        provider: "resend",
        label: "Resend Email",
        channel: "email",
        status: "blocked",
        dry_run_only: true,
        real_send_enabled: false,
        can_initialize_adapter: true,
        checks: [
          "Resend adapter class is available.",
          "Real Resend sendMessage remains disabled by design.",
          "Dry validation does not read or expose API keys.",
          "Dry validation does not call Resend API.",
        ],
        warnings: [
          "Real email sending is intentionally blocked until an explicit future production gate.",
        ],
      };

    case "zalo_zns":
      return {
        provider: "zalo_zns",
        label: "Zalo ZNS",
        channel: "zalo",
        status: "blocked",
        dry_run_only: true,
        real_send_enabled: false,
        can_initialize_adapter: true,
        checks: [
          "Zalo ZNS adapter class is available.",
          "Real Zalo ZNS sendMessage remains disabled by design.",
          "Dry validation does not read or expose Zalo secrets.",
          "Dry validation does not call Zalo API.",
        ],
        warnings: [
          "Real Zalo sending is intentionally blocked until an explicit future production gate.",
        ],
      };
  }
}