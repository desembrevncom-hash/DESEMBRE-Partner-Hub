// Helper dùng chung cho việc lọc Audience (Marketing)
// Đảm bảo nguyên tắc chặn gửi production: Không bao giờ gọi Provider từ helper này.

export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\s+/g, "").trim();
}

export function isValidEmail(email: string): boolean {
  // Simple validation for email
  const nEmail = normalizeEmail(email);
  return nEmail.length > 0 && nEmail.includes("@");
}

export function isValidPhone(phone: string): boolean {
  // Simple validation for phone
  const nPhone = normalizePhone(phone);
  return nPhone.length >= 9;
}

export function isBlockedOrInactive(customer: any): boolean {
  return customer.is_active === false;
}

export function buildSuppressionSet(suppressions: any[] | null): Set<string> {
  const set = new Set<string>();
  if (suppressions && suppressions.length > 0) {
    for (const s of suppressions) {
      if (s.is_active) {
        set.add(`${s.channel}:${s.normalized_contact_value}`);
      }
    }
  }
  return set;
}

// Hàm đánh giá sự đủ điều kiện cho Kênh Email
export function evaluateEmailEligibility(
  customer: any,
  suppressionSet: Set<string>,
  seenContacts: Set<string>,
): {
  isValidContact: boolean;
  isDuplicate: boolean;
  isSuppressed: boolean;
  hasConsent: boolean;
  contactValForPreview: string;
} {
  let isValidContact = false;
  let hasConsent = customer.marketing_opt_in === true;
  let isDuplicate = false;
  let isSuppressed = false;
  let contactValForPreview = "";

  if (customer.email && isValidEmail(customer.email)) {
    const nEmail = normalizeEmail(customer.email);
    contactValForPreview = nEmail;

    if (seenContacts.has(`email:${nEmail}`)) {
      isDuplicate = true;
    } else {
      seenContacts.add(`email:${nEmail}`);
    }

    if (suppressionSet.has(`email:${nEmail}`)) {
      isSuppressed = true;
    }

    isValidContact = true;
  }

  return { isValidContact, isDuplicate, isSuppressed, hasConsent, contactValForPreview };
}

// Hàm đánh giá sự đủ điều kiện cho Kênh Zalo
export function evaluateZaloEligibility(
  customer: any,
  zProfile: any,
  suppressionSet: Set<string>,
  seenContacts: Set<string>,
): {
  isValidContact: boolean;
  isDuplicate: boolean;
  isSuppressed: boolean;
  hasConsent: boolean;
  contactValForPreview: string;
} {
  let isValidContact = false;
  let hasConsent = customer.marketing_opt_in === true; // Hoặc logic consent riêng của Zalo OA
  let isDuplicate = false;
  let isSuppressed = false;
  let contactValForPreview = "";

  if (zProfile && zProfile.zalo_id) {
    const nZaloId = zProfile.zalo_id.trim();
    contactValForPreview = `Zalo: ${nZaloId}`;

    if (seenContacts.has(`zalo_id:${nZaloId}`)) {
      isDuplicate = true;
    } else {
      seenContacts.add(`zalo_id:${nZaloId}`);
    }

    if (suppressionSet.has(`zalo_id:${nZaloId}`)) {
      isSuppressed = true;
    }

    isValidContact = true;
  } else if (customer.phone && isValidPhone(customer.phone)) {
    // Fallback qua phone nếu template cho phép ZNS qua phone
    const nPhone = normalizePhone(customer.phone);
    contactValForPreview = `Phone: ${nPhone}`;

    if (seenContacts.has(`phone:${nPhone}`)) {
      isDuplicate = true;
    } else {
      seenContacts.add(`phone:${nPhone}`);
    }

    if (suppressionSet.has(`phone:${nPhone}`)) {
      isSuppressed = true;
    }

    isValidContact = true;
  }

  return { isValidContact, isDuplicate, isSuppressed, hasConsent, contactValForPreview };
}

// Hàm tổng hợp lọc Audience
export function buildEligibleAudience(
  customers: any[],
  campaignChannel: string,
  zaloProfilesMap: Map<string, any>,
  suppressionSet: Set<string>,
  previewLimit: number = 10,
) {
  let eligible_count = 0;
  const excluded_counts = {
    no_consent: 0,
    opt_out: 0,
    blocked_or_inactive: 0,
    duplicate: 0,
    suppressed: 0,
    invalid_contact: 0,
  };

  const preview_recipients: any[] = [];
  const eligible_recipients: any[] = [];
  const seenContacts = new Set<string>();

  const isEmail = campaignChannel === "email" || campaignChannel === "email_campaign";
  const isZalo =
    campaignChannel === "zalo" || campaignChannel === "zalo_oa" || campaignChannel === "zalo_zns";

  for (const c of customers) {
    if (isBlockedOrInactive(c)) {
      excluded_counts.blocked_or_inactive++;
      continue;
    }

    if (c.marketing_opt_out_at) {
      excluded_counts.opt_out++;
      continue;
    }

    let checkResult = {
      isValidContact: false,
      isDuplicate: false,
      isSuppressed: false,
      hasConsent: false,
      contactValForPreview: "",
    };

    if (isEmail) {
      checkResult = evaluateEmailEligibility(c, suppressionSet, seenContacts);
    } else if (isZalo) {
      const zProfile = zaloProfilesMap.get(c.id);
      checkResult = evaluateZaloEligibility(c, zProfile, suppressionSet, seenContacts);
    }

    if (!checkResult.isValidContact) {
      excluded_counts.invalid_contact++;
      continue;
    }

    if (checkResult.isDuplicate) {
      excluded_counts.duplicate++;
      continue;
    }

    if (checkResult.isSuppressed) {
      excluded_counts.suppressed++;
      continue;
    }

    if (!checkResult.hasConsent) {
      excluded_counts.no_consent++;
      continue;
    }

    // Nếu qua được tất cả các cửa ải an toàn
    eligible_count++;

    eligible_recipients.push({
      customer_id: c.id,
      email: isEmail ? checkResult.contactValForPreview : null,
      zalo_id: isZalo && zaloProfilesMap.get(c.id) ? zaloProfilesMap.get(c.id).zalo_id : null,
      phone: isZalo && !zaloProfilesMap.get(c.id) ? checkResult.contactValForPreview : null,
      marketing_opt_in: c.marketing_opt_in,
      marketing_opt_out_at: c.marketing_opt_out_at,
    });

    if (preview_recipients.length < previewLimit) {
      preview_recipients.push({
        id: c.id,
        name: c.name,
        contact: checkResult.contactValForPreview,
      });
    }
  }

  return { eligible_count, excluded_counts, preview_recipients, eligible_recipients };
}
