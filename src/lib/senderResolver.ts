/**
 * senderResolver.ts
 * Phase M-Infra 2 — Sender Runtime Resolver
 *
 * Pure TypeScript — runs both client-side and server-side.
 * No secrets, no API calls. Returns resolution decision only.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type SenderChannel = 'email' | 'zalo' | 'zalo_oa' | 'phone' | 'sms';
export type MessageMode   = 'campaign' | 'sale_followup';
export type SenderType    = 'business' | 'personal' | 'none';

export interface SenderAccount {
  id: string;
  name: string;
  channel: string;        // 'email' | 'zalo_oa' | 'sms' ...
  is_active: boolean;
  health_status?: string; // 'healthy' | 'warning' | 'error' | 'unknown'
  daily_usage?: number;
  daily_limit?: number;
}

export interface PersonalSenderAccount {
  id: string;
  user_id: string;
  platform: string;       // 'zalo' | 'email' | 'phone' ...
  account_name?: string;
  is_active: boolean;
  health_status?: string;
}

export interface ResolverCustomer {
  id: string;
  marketing_opt_out_at?: string | null;
  marketing_opt_in?: boolean;
}

export interface ResolverInput {
  /** Kênh yêu cầu gửi */
  channel: SenderChannel;
  /** Mode: campaign = business sender; sale_followup = personal sender */
  mode: MessageMode;
  /** Thông tin tuân thủ của khách hàng */
  customer: ResolverCustomer;
  /** User ID của Sale owner (dùng khi mode = sale_followup) */
  ownerUserId?: string;
  /** Danh sách business senders đã load */
  businessSenders?: SenderAccount[];
  /** Danh sách personal senders của ownerUser */
  personalSenders?: PersonalSenderAccount[];
  /** (Optional) Campaign ID, Template ID để trace */
  campaignId?: string;
  templateId?: string;
}

export interface ResolverResult {
  allowed: boolean;
  senderType: SenderType;
  senderId: string | null;
  channel: SenderChannel;
  reason?: string;
  warnings: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isHealthBlocked(health?: string): boolean {
  return health === 'error';
}

function isHealthWarning(health?: string): boolean {
  return health === 'warning';
}

function isQuotaExceeded(sender: SenderAccount): boolean {
  const limit = sender.daily_limit ?? 0;
  const usage = sender.daily_usage ?? 0;
  return limit > 0 && usage >= limit;
}

/** Normalize channel name for matching business sender channel field */
function normalizeBizChannel(ch: SenderChannel): string {
  if (ch === 'zalo_oa') return 'zalo_oa';
  if (ch === 'zalo')    return 'zalo_oa'; // zalo follow-up should prefer personal, but campaign = zalo_oa
  if (ch === 'email')   return 'email';
  if (ch === 'sms')     return 'sms';
  return ch;
}

/** Normalize personal sender platform field */
function normalizePersonalPlatform(ch: SenderChannel): string {
  if (ch === 'zalo' || ch === 'zalo_oa') return 'zalo';
  if (ch === 'email') return 'email';
  if (ch === 'phone' || ch === 'sms')   return 'phone';
  return ch;
}

// ── Main Resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve which sender to use for a given message request.
 *
 * Rules (in priority order):
 * 1. Customer opt-out marketing → blocked
 * 2. mode=campaign + channel=email → business email sender
 * 3. mode=campaign + channel=zalo/zalo_oa → business zalo_oa sender
 * 4. mode=sale_followup → personal sender of ownerUserId matching channel
 * 5. Quota exceeded → blocked
 * 6. Health = error → blocked; health = warning → allowed + warning
 * 7. No matching sender found → blocked
 */
export function resolveSenderForMessage(input: ResolverInput): ResolverResult {
  const { channel, mode, customer, businessSenders = [], personalSenders = [], ownerUserId } = input;
  const warnings: string[] = [];

  // ── Rule 1: Opt-out check ─────────────────────────────────────────────────
  if (customer.marketing_opt_out_at) {
    return {
      allowed: false,
      senderType: 'none',
      senderId: null,
      channel,
      reason: 'Khách hàng đã từ chối nhận tin Marketing (Opt-out). Không thể gửi.',
      warnings: [],
    };
  }

  // ── Rule 2-3: Campaign mode — use business sender ─────────────────────────
  if (mode === 'campaign') {
    const bizChannel = normalizeBizChannel(channel);

    // Find first active business sender matching channel
    const candidates = businessSenders.filter(
      s => s.is_active && (s.channel === bizChannel || s.channel?.toLowerCase().includes(bizChannel))
    );

    if (candidates.length === 0) {
      return {
        allowed: false,
        senderType: 'none',
        senderId: null,
        channel,
        reason: `Không tìm thấy Business Sender đang hoạt động cho kênh ${channel}. Vui lòng cấu hình trong Admin › Sender Accounts.`,
        warnings: [],
      };
    }

    // Pick the healthiest sender (prefer healthy, then warning, avoid error)
    const sender = candidates.find(s => !isHealthBlocked(s.health_status) && !isQuotaExceeded(s))
      ?? candidates.find(s => !isHealthBlocked(s.health_status))
      ?? candidates[0];

    // Rule 5: Quota exceeded
    if (isQuotaExceeded(sender)) {
      return {
        allowed: false,
        senderType: 'business',
        senderId: sender.id,
        channel,
        reason: `Sender "${sender.name}" đã vượt quota ngày (${sender.daily_usage}/${sender.daily_limit}). Không thể gửi thêm.`,
        warnings: [],
      };
    }

    // Rule 6a: Health error → block
    if (isHealthBlocked(sender.health_status)) {
      return {
        allowed: false,
        senderType: 'business',
        senderId: sender.id,
        channel,
        reason: `Sender "${sender.name}" đang lỗi (health = error). Không thể gửi chiến dịch.`,
        warnings: [],
      };
    }

    // Rule 6b: Health warning → allowed with warning
    if (isHealthWarning(sender.health_status)) {
      warnings.push(`Sender "${sender.name}" đang ở trạng thái cảnh báo. Nên kiểm tra lại trong Admin.`);
    }

    // Quota near limit warning
    const usagePct = (sender.daily_limit ?? 0) > 0
      ? ((sender.daily_usage ?? 0) / sender.daily_limit!) * 100
      : 0;
    if (usagePct > 80) {
      warnings.push(`Quota sender "${sender.name}" gần đầy: ${sender.daily_usage}/${sender.daily_limit} (${Math.round(usagePct)}%).`);
    }

    return {
      allowed: true,
      senderType: 'business',
      senderId: sender.id,
      channel,
      reason: undefined,
      warnings,
    };
  }

  // ── Rule 4: Sale follow-up mode — use personal sender ─────────────────────
  if (mode === 'sale_followup') {
    if (!ownerUserId) {
      return {
        allowed: false,
        senderType: 'none',
        senderId: null,
        channel,
        reason: 'Không xác định được Sale owner. Không thể chọn sender cá nhân.',
        warnings: [],
      };
    }

    const platform = normalizePersonalPlatform(channel);
    const personalCandidate = personalSenders.find(
      a => a.user_id === ownerUserId &&
           a.platform?.toLowerCase().includes(platform) &&
           a.is_active
    );

    if (!personalCandidate) {
      return {
        allowed: false,
        senderType: 'none',
        senderId: null,
        channel,
        reason: `Sale chưa cấu hình tài khoản cá nhân cho kênh ${channel}. Liên hệ Admin để thiết lập.`,
        warnings: [],
      };
    }

    // Health check
    if (isHealthBlocked(personalCandidate.health_status)) {
      return {
        allowed: false,
        senderType: 'personal',
        senderId: personalCandidate.id,
        channel,
        reason: `Tài khoản cá nhân "${personalCandidate.account_name}" đang lỗi. Cần kết nối lại.`,
        warnings: [],
      };
    }

    if (isHealthWarning(personalCandidate.health_status)) {
      warnings.push(`Tài khoản cá nhân "${personalCandidate.account_name}" đang cảnh báo. Nên kiểm tra lại.`);
    }

    return {
      allowed: true,
      senderType: 'personal',
      senderId: personalCandidate.id,
      channel,
      reason: undefined,
      warnings,
    };
  }

  // Fallback — unknown mode
  return {
    allowed: false,
    senderType: 'none',
    senderId: null,
    channel,
    reason: 'Mode không hợp lệ.',
    warnings: [],
  };
}
