export interface ProviderResponse {
  success: boolean;
  provider_message_id?: string;
  error_code?: string;
  error_message?: string;
}

export interface MarketingProviderAdapter {
  sendMessage(payload: any): Promise<ProviderResponse>;
}

export class MockProviderAdapter implements MarketingProviderAdapter {
  async sendMessage(payload: any): Promise<ProviderResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    return {
      success: true,
      provider_message_id: `mock_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }
}

export class ResendAdapter implements MarketingProviderAdapter {
  async sendMessage(payload: any): Promise<ProviderResponse> {
    throw new Error("NotImplementedError: Real Resend calls are disabled in M17.");
  }
}

export class ZaloZnsAdapter implements MarketingProviderAdapter {
  async sendMessage(payload: any): Promise<ProviderResponse> {
    throw new Error("NotImplementedError: Real Zalo ZNS calls are disabled in M17.");
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
