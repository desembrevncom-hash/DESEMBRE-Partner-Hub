import { toSafeString, safeDigits } from "../utils/safeString";
function isSafeEmail(value: unknown): boolean {
  const str = toSafeString(value).trim().toLowerCase();
  return str.includes("@") && str.includes(".");
}

export type ContactChannelType =
  | "phone"
  | "possible_phone_missing_zero"
  | "facebook_url"
  | "facebook_uid"
  | "email"
  | "unknown"
  | "empty";

export interface ContactClassification {
  type: ContactChannelType;
  rawValue: string;
  normalizedValue: string;
  isCallable: boolean;
  isZaloCapable: boolean;
  isRemarketingCapable: boolean;
  warning?: string;
}

export interface CustomerContactSummary {
  primaryPhone: string;
  callablePhone: string;
  zaloPhone: string;
  facebookUrl: string;
  facebookUid: string;
  email: string;
  availableChannels: string[];
  warnings: string[];
  dataQualityIssues: { code: string; label: string; rawValue: string }[];
}

export function isFacebookUidLike(value: unknown): boolean {
  const str = toSafeString(value).trim();
  if (!str) return false;
  // 12+ numeric digits without non-numeric characters (maybe a + prefix we ignore)
  const digits = safeDigits(str);
  if (digits === str && digits.length >= 12) return true;
  return false;
}

export function isFacebookUrlLike(value: unknown): boolean {
  const str = toSafeString(value).toLowerCase().trim();
  if (!str) return false;
  return (
    str.includes("facebook.com") ||
    str.includes("fb.com") ||
    str.includes("m.facebook.com") ||
    str.includes("profile.php?id=")
  );
}

export function extractFacebookUidFromUrl(value: unknown): string {
  const str = toSafeString(value).trim();
  if (!str) return "";
  try {
    const url = new URL(str);
    const id = url.searchParams.get("id");
    if (id && isFacebookUidLike(id)) return id;
  } catch (e) {
    // maybe it's not a full valid URL, fallback to regex
    const match = str.match(/profile\.php\?id=(\d+)/);
    if (match && match[1]) return match[1];
  }
  return "";
}

export function isVietnamPhone(value: unknown): boolean {
  const str = toSafeString(value).trim();
  if (!str) return false;
  if (isFacebookUidLike(str)) return false;
  if (isFacebookUrlLike(str)) return false;
  
  const digits = safeDigits(str);
  if (!digits) return false;
  
  // A valid VN mobile usually is 10 digits starting with 0
  // e.g., 0943597123
  if (digits.length === 10 && digits.startsWith("0")) return true;
  
  // +84 or 84 followed by 9 digits
  if (str.startsWith("+84") && digits.length === 11) return true;
  if (digits.length === 11 && digits.startsWith("84")) return true;
  
  // Allow 11-digit numbers starting with 0 if landlines exist, but for mobile strictness, maybe true
  if (digits.length === 11 && digits.startsWith("0")) return true;

  return false;
}

export function isPossibleVietnamPhoneMissingLeadingZero(value: unknown): boolean {
  const str = toSafeString(value).trim();
  if (!str) return false;
  if (isFacebookUidLike(str)) return false;
  
  const digits = safeDigits(str);
  // 9 digits without leading 0 -> e.g. 943597123 instead of 0943597123
  if (digits.length === 9 && !digits.startsWith("0")) return true;
  return false;
}

export function classifyContactValue(value: unknown): ContactClassification {
  const rawValue = toSafeString(value).trim();
  if (!rawValue) {
    return {
      type: "empty",
      rawValue: "",
      normalizedValue: "",
      isCallable: false,
      isZaloCapable: false,
      isRemarketingCapable: false,
    };
  }

  if (isFacebookUrlLike(rawValue)) {
    return {
      type: "facebook_url",
      rawValue,
      normalizedValue: rawValue,
      isCallable: false,
      isZaloCapable: false,
      isRemarketingCapable: true,
    };
  }

  if (isFacebookUidLike(rawValue)) {
    return {
      type: "facebook_uid",
      rawValue,
      normalizedValue: safeDigits(rawValue),
      isCallable: false,
      isZaloCapable: false,
      isRemarketingCapable: true, // Only if pushed to FB channel, but strictly, yes capable via Custom Audiences
      warning: "FB UID KHÔNG PHẢI SĐT",
    };
  }

  if (isSafeEmail(rawValue)) {
    return {
      type: "email",
      rawValue,
      normalizedValue: rawValue.toLowerCase(),
      isCallable: false,
      isZaloCapable: false,
      isRemarketingCapable: true,
    };
  }

  if (isVietnamPhone(rawValue)) {
    return {
      type: "phone",
      rawValue,
      normalizedValue: safeDigits(rawValue),
      isCallable: true,
      isZaloCapable: true,
      isRemarketingCapable: true,
    };
  }

  if (isPossibleVietnamPhoneMissingLeadingZero(rawValue)) {
    return {
      type: "possible_phone_missing_zero",
      rawValue,
      normalizedValue: "0" + safeDigits(rawValue),
      isCallable: false,
      isZaloCapable: false,
      isRemarketingCapable: false,
      warning: "CÓ THỂ THIẾU SỐ 0",
    };
  }

  return {
    type: "unknown",
    rawValue,
    normalizedValue: rawValue,
    isCallable: false,
    isZaloCapable: false,
    isRemarketingCapable: false,
  };
}

export function getCustomerContactSummary(customer: any): CustomerContactSummary {
  const summary: CustomerContactSummary = {
    primaryPhone: "",
    callablePhone: "",
    zaloPhone: "",
    facebookUrl: "",
    facebookUid: "",
    email: "",
    availableChannels: [],
    warnings: [],
    dataQualityIssues: [],
  };

  if (!customer) return summary;

  // Process Phone field
  const phoneToClassify = customer.normalized_phone || customer.phone;
  const phoneClass = classifyContactValue(phoneToClassify);
  if (phoneClass.type !== "empty") {
    summary.primaryPhone = phoneClass.rawValue;
    if (phoneClass.isCallable) {
      summary.callablePhone = phoneClass.normalizedValue;
      summary.zaloPhone = phoneClass.normalizedValue;
      if (!summary.availableChannels.includes("phone")) summary.availableChannels.push("phone");
      if (!summary.availableChannels.includes("zalo")) summary.availableChannels.push("zalo");
    }

    if (phoneClass.type === "facebook_uid") {
      summary.facebookUid = phoneClass.normalizedValue;
      summary.dataQualityIssues.push({
        code: "PHONE_IS_FACEBOOK_UID",
        label: "Phone contains Facebook UID",
        rawValue: phoneClass.rawValue,
      });
      if (phoneClass.warning) summary.warnings.push(phoneClass.warning);
    } else if (phoneClass.type === "facebook_url") {
      summary.facebookUrl = phoneClass.rawValue;
      summary.dataQualityIssues.push({
        code: "PHONE_IS_FACEBOOK_URL",
        label: "Phone contains Facebook URL",
        rawValue: phoneClass.rawValue,
      });
    } else if (phoneClass.type === "possible_phone_missing_zero") {
      summary.dataQualityIssues.push({
        code: "PHONE_POSSIBLY_MISSING_LEADING_ZERO",
        label: "Phone possibly missing leading zero",
        rawValue: phoneClass.rawValue,
      });
      if (phoneClass.warning) summary.warnings.push(phoneClass.warning);
    }
  } else {
    summary.dataQualityIssues.push({
      code: "MISSING_PHONE",
      label: "Missing Phone Number",
      rawValue: "",
    });
  }

  // Process Email field
  const emailClass = classifyContactValue(customer.email);
  if (emailClass.type === "email") {
    summary.email = emailClass.normalizedValue;
    if (!summary.availableChannels.includes("email")) summary.availableChannels.push("email");
  } else if (emailClass.type !== "empty") {
    summary.dataQualityIssues.push({
      code: "INVALID_EMAIL",
      label: "Invalid Email Address",
      rawValue: emailClass.rawValue,
    });
  } else {
    summary.dataQualityIssues.push({
      code: "MISSING_EMAIL",
      label: "Missing Email Address",
      rawValue: "",
    });
  }

  // Process explicitly mapped DB fields
  const safeFbUid = toSafeString(customer.facebook_uid).trim();
  if (safeFbUid && !summary.facebookUid) summary.facebookUid = safeFbUid;

  const safeRawUrl = toSafeString(customer.raw_url).trim();
  if (safeRawUrl && !summary.facebookUrl) summary.facebookUrl = safeRawUrl;
  
  if (safeRawUrl && !summary.facebookUid) {
     const extracted = extractFacebookUidFromUrl(safeRawUrl);
     if (extracted) summary.facebookUid = extracted;
  }

  // Check Name for UID/URL issues
  const safeName = toSafeString(customer.name || customer.contact_name).trim();
  if (isFacebookUidLike(safeName)) {
    summary.dataQualityIssues.push({
      code: "NAME_IS_FACEBOOK_UID",
      label: "Name contains Facebook UID",
      rawValue: safeName,
    });
    if (!summary.facebookUid) summary.facebookUid = safeDigits(safeName);
  } else if (isFacebookUrlLike(safeName)) {
    summary.dataQualityIssues.push({
      code: "NAME_IS_FACEBOOK_URL",
      label: "Name contains Facebook URL",
      rawValue: safeName,
    });
    if (!summary.facebookUrl) summary.facebookUrl = safeName;
  }

  // Populate FB channel
  if (summary.facebookUrl || summary.facebookUid) {
    if (!summary.availableChannels.includes("facebook")) summary.availableChannels.push("facebook");
  }

  if (summary.facebookUrl && !summary.facebookUid) {
    summary.dataQualityIssues.push({
      code: "FACEBOOK_URL_NO_UID",
      label: "Facebook URL exists but missing UID",
      rawValue: summary.facebookUrl,
    });
  }

  if (summary.availableChannels.length === 0) {
    summary.dataQualityIssues.push({
      code: "MISSING_CONTACT_CHANNEL",
      label: "No valid contact channels available",
      rawValue: "",
    });
  }
  
  if (!customer.owner_sale_id && !customer.sale_owner_id) { // Allow fallback field name depending on actual type
    summary.dataQualityIssues.push({
      code: "UNASSIGNED_SALE",
      label: "Unassigned Sale Owner",
      rawValue: "",
    });
  }

  // General cleanup flag
  if (summary.dataQualityIssues.length > 0) {
    summary.warnings.push("DATA CẦN LÀM SẠCH");
  }

  // Deduplicate warnings
  summary.warnings = Array.from(new Set(summary.warnings));

  return summary;
}
