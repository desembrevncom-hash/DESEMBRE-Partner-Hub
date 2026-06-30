import { ConsentEvaluationResult, evaluateCustomerConsent, CustomerMarketingPreferences } from "./evaluateCustomerConsent";

export interface MarketingSafetySettings {
  global_kill_switch: boolean;
  email_enabled: boolean;
  zalo_enabled: boolean;
  require_admin_approval: boolean;
  daily_send_quota: number;
  per_campaign_quota: number;
  cooldown_minutes: number;
  duplicate_prevention_hours: number;
}

export interface MarketingSafetyContext {
  channel: 'email' | 'zalo' | 'all';
  approved?: boolean;
  customer?: {
    id?: string;
    email?: string;
    phone?: string;
  };
  suppressions?: any[]; // The active suppression list
  current_daily_sends?: number; // How many sent today
  current_campaign_sends?: number; // How many sent in this campaign
  last_sent_at?: string; // ISO string of last send time
  
  is_sandbox_internal?: boolean;
  customer_preferences?: CustomerMarketingPreferences | null;
}

export interface SafetyEvaluationResult {
  allowed: boolean;
  reasons: string[];
  warnings: string[];
  consent?: ConsentEvaluationResult;
}

export function evaluateMarketingSafety(
  settings: MarketingSafetySettings,
  context: MarketingSafetyContext
): SafetyEvaluationResult {
  const result: SafetyEvaluationResult = {
    allowed: true,
    reasons: [],
    warnings: [],
  };

  const isSandboxInternal = context.is_sandbox_internal === true;
  const hasCustomer = !!context.customer?.id;

  // 1. Detect Context & Consent Gate
  if (isSandboxInternal) {
    result.consent = { allowed: true, reason: "Sandbox internal job skips consent check.", code: "SANDBOX_SKIPPED" };
  } else if (!hasCustomer) {
    result.allowed = false;
    result.reasons.push("Non-sandbox job requires a valid customer ID.");
    result.consent = { allowed: false, reason: "Missing customer context.", code: "MISSING_CUSTOMER_ID" };
  } else {
    // Customer marketing job
    const consentRes = evaluateCustomerConsent(context.channel, context.customer_preferences);
    result.consent = consentRes;
    if (!consentRes.allowed) {
      result.allowed = false;
      result.reasons.push(`Consent Gate Blocked: ${consentRes.reason}`);
    }
  }

  // 2. Global Kill Switch
  if (settings.global_kill_switch) {
    if (isSandboxInternal) {
      result.warnings.push("Global Kill Switch is active, but bypassed for internal sandbox flow.");
    } else {
      result.allowed = false;
      result.reasons.push("GLOBAL KILL SWITCH IS ACTIVE. All sends are blocked.");
    }
  }

  // 3. Channel specific blocks
  if (context.channel === 'email' && !settings.email_enabled) {
    if (isSandboxInternal) {
      result.warnings.push("Email sending is globally disabled, but bypassed for internal sandbox flow.");
    } else {
      result.allowed = false;
      result.reasons.push("Email sending is globally disabled.");
    }
  }
  if (context.channel === 'zalo' && !settings.zalo_enabled) {
    if (isSandboxInternal) {
      result.warnings.push("Zalo sending is globally disabled, but bypassed for internal sandbox flow.");
    } else {
      result.allowed = false;
      result.reasons.push("Zalo sending is globally disabled.");
    }
  }

  // 4. Admin Approval
  if (settings.require_admin_approval && !context.approved) {
    result.allowed = false;
    result.reasons.push("Admin approval is required for this action.");
  }

  // 5. Suppression List Check (skip for sandbox internal without customer_id)
  if (context.customer && context.suppressions && context.suppressions.length > 0) {
    const isSuppressed = context.suppressions.some(s => {
      if (!s.is_active) return false;
      // Channel match: 'all' applies to everything. 
      if (s.channel !== 'all' && s.channel !== context.channel) return false;
      
      const emailNorm = context.customer?.email?.trim().toLowerCase();
      const phoneNorm = context.customer?.phone?.trim().toLowerCase();
      
      const matchEmail = emailNorm && s.normalized_contact_value === emailNorm;
      const matchPhone = phoneNorm && s.normalized_contact_value === phoneNorm;
      
      return matchEmail || matchPhone;
    });

    if (isSuppressed) {
      result.allowed = false;
      result.reasons.push("Customer is currently in the active suppression list.");
    }
  }

  // 6. Quotas (Warnings/Blocks)
  if (!isSandboxInternal) { // Skip quotas for internal sandbox tests
    if (settings.daily_send_quota <= 0) {
      result.warnings.push("Daily send quota is set to 0. You might want to increase this for real sends.");
      if ((context.current_daily_sends || 0) >= settings.daily_send_quota && settings.daily_send_quota !== -1) {
         result.allowed = false;
         result.reasons.push(`Daily send limit reached or quota is 0. (Current: ${context.current_daily_sends || 0}, Max: ${settings.daily_send_quota})`);
      }
    } else if ((context.current_daily_sends || 0) >= settings.daily_send_quota) {
      result.allowed = false;
      result.reasons.push(`Daily send limit reached. (Current: ${context.current_daily_sends || 0}, Max: ${settings.daily_send_quota})`);
    }

    if (settings.per_campaign_quota <= 0) {
      if ((context.current_campaign_sends || 0) >= settings.per_campaign_quota && settings.per_campaign_quota !== -1) {
        result.allowed = false;
        result.reasons.push(`Per-campaign send limit reached or quota is 0. (Current: ${context.current_campaign_sends || 0}, Max: ${settings.per_campaign_quota})`);
      }
    } else if ((context.current_campaign_sends || 0) >= settings.per_campaign_quota) {
      result.allowed = false;
      result.reasons.push(`Per-campaign send limit reached. (Current: ${context.current_campaign_sends || 0}, Max: ${settings.per_campaign_quota})`);
    }

    // 7. Cooldown
    if (settings.cooldown_minutes > 0 && context.last_sent_at) {
      const lastSentTime = new Date(context.last_sent_at).getTime();
      const now = new Date().getTime();
      const diffMinutes = (now - lastSentTime) / (1000 * 60);
      if (diffMinutes < settings.cooldown_minutes) {
        result.allowed = false;
        result.reasons.push(`Cooldown period active. Must wait ${Math.ceil(settings.cooldown_minutes - diffMinutes)} more minutes.`);
      }
    }
  }

  return result;
}
