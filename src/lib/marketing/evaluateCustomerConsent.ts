export interface CustomerMarketingPreferences {
  customer_id: string;
  email_opt_in: boolean;
  zalo_opt_in: boolean;
  global_opt_out: boolean;
}

export type MarketingChannel = 'email' | 'zalo' | 'global';

export interface ConsentEvaluationResult {
  allowed: boolean;
  reason: string;
  code: string;
}

/**
 * Pure helper to evaluate if a customer has given consent for a specific marketing channel.
 * Implements strict fail-closed logic.
 * 
 * @param channel The marketing channel ('email', 'zalo', 'global')
 * @param preferences The customer's marketing preference row
 * @returns ConsentEvaluationResult with allowed boolean and explanatory reason
 */
export function evaluateCustomerConsent(
  channel: MarketingChannel | string,
  preferences?: CustomerMarketingPreferences | null
): ConsentEvaluationResult {
  
  if (!preferences) {
    return {
      allowed: false,
      reason: "Missing marketing preferences record. Defaulting to opt-out.",
      code: "MISSING_PREFERENCES"
    };
  }

  if (preferences.global_opt_out) {
    return {
      allowed: false,
      reason: "Customer has opted out of all global marketing communications.",
      code: "GLOBAL_OPT_OUT"
    };
  }

  switch (channel) {
    case 'email':
      if (preferences.email_opt_in) {
        return { allowed: true, reason: "Email channel opted in.", code: "CONSENT_GRANTED" };
      }
      return { allowed: false, reason: "Customer has not explicitly opted into email marketing.", code: "EMAIL_OPT_OUT" };
      
    case 'zalo':
      if (preferences.zalo_opt_in) {
        return { allowed: true, reason: "Zalo channel opted in.", code: "CONSENT_GRANTED" };
      }
      return { allowed: false, reason: "Customer has not explicitly opted into Zalo marketing.", code: "ZALO_OPT_OUT" };

    default:
      return { allowed: false, reason: `Unknown channel requested: ${channel}`, code: "UNKNOWN_CHANNEL" };
  }
}
