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
}

export interface SafetyEvaluationResult {
  allowed: boolean;
  reasons: string[];
  warnings: string[];
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

  // 1. Global Kill Switch
  if (settings.global_kill_switch) {
    result.allowed = false;
    result.reasons.push("GLOBAL KILL SWITCH IS ACTIVE. All sends are blocked.");
  }

  // 2. Channel specific blocks
  if (context.channel === 'email' && !settings.email_enabled) {
    result.allowed = false;
    result.reasons.push("Email sending is globally disabled.");
  }
  if (context.channel === 'zalo' && !settings.zalo_enabled) {
    result.allowed = false;
    result.reasons.push("Zalo sending is globally disabled.");
  }

  // 3. Admin Approval
  if (settings.require_admin_approval && !context.approved) {
    result.allowed = false;
    result.reasons.push("Admin approval is required for this action.");
  }

  // 4. Suppression List Check
  if (context.customer && context.suppressions && context.suppressions.length > 0) {
    const isSuppressed = context.suppressions.some(s => {
      if (!s.is_active) return false;
      // Channel match: 'all' applies to everything. 
      // Specific channel applies only to that channel.
      if (s.channel !== 'all' && s.channel !== context.channel) return false;
      
      const emailNorm = context.customer?.email?.trim().toLowerCase();
      const phoneNorm = context.customer?.phone?.trim().toLowerCase(); // Basic norm
      
      const matchEmail = emailNorm && s.normalized_contact_value === emailNorm;
      const matchPhone = phoneNorm && s.normalized_contact_value === phoneNorm;
      
      return matchEmail || matchPhone;
    });

    if (isSuppressed) {
      result.allowed = false;
      result.reasons.push("Customer is currently in the active suppression list.");
    }
  }

  // 5. Quotas (Warnings/Blocks)
  if (settings.daily_send_quota <= 0) {
    result.warnings.push("Daily send quota is set to 0. You might want to increase this for real sends.");
    // For MVP, we can block if quota is 0, or just warn. We'll warn if it's 0, but block if exceeded.
    if ((context.current_daily_sends || 0) >= settings.daily_send_quota && settings.daily_send_quota !== -1) {
       // Wait, if quota is 0, it means blocked unless we treat 0 as unlimited. The requirement says 0 is safe/fail-closed.
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

  // 6. Cooldown
  if (settings.cooldown_minutes > 0 && context.last_sent_at) {
    const lastSentTime = new Date(context.last_sent_at).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - lastSentTime) / (1000 * 60);
    if (diffMinutes < settings.cooldown_minutes) {
      result.allowed = false;
      result.reasons.push(`Cooldown period active. Must wait ${Math.ceil(settings.cooldown_minutes - diffMinutes)} more minutes.`);
    }
  }

  return result;
}
