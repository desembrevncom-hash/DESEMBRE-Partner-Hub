export type CustomerShape = Partial<{
  id: string;
  name: string | null;
  contact_name: string | null;
  business_name: string | null;
  facility_name: string | null;
  phone: string | null;
  facebook_display_name: string | null;
  customer_social_profiles: any;
  social_profiles: any;
  [key: string]: any;
}>;

import { toSafeString, safeTrim, safeLower, safeIncludes } from "../utils/safeString";

export function isUrlLike(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s = safeTrim(value);
  if (!s) return false;
  const lower = safeLower(s);
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    safeIncludes(lower, "www.facebook.com") ||
    safeIncludes(lower, "facebook.com/") ||
    lower === "facebook.com" ||
    safeIncludes(lower, "m.facebook.com") ||
    safeIncludes(lower, "fb.com") ||
    safeIncludes(lower, "profile.php?id=")
  );
}

export function isUidLike(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s = safeTrim(value);
  if (!s) return false;
  // False for Vietnamese phone numbers (start with 0, 10-11 digits)
  if (/^0\d{9,10}$/.test(s)) return false;
  
  // True for long numeric UID-like strings (12+ digits)
  return /^\d{12,}$/.test(s);
}

export function getFacebookDisplayNameFromCustomer(customer: CustomerShape | null | undefined): string | null {
  if (!customer) return null;

  // 1. customer.facebook_display_name
  if (customer.facebook_display_name) return customer.facebook_display_name;

  // 2. customer.customer_social_profiles[0].facebook_display_name
  if (Array.isArray(customer.customer_social_profiles) && customer.customer_social_profiles.length > 0) {
    for (const profile of customer.customer_social_profiles) {
      if (profile?.facebook_display_name) return profile.facebook_display_name;
    }
  }

  // 3. customer.customer_social_profiles.facebook_display_name
  if (
    customer.customer_social_profiles &&
    !Array.isArray(customer.customer_social_profiles) &&
    typeof customer.customer_social_profiles === "object"
  ) {
    if (customer.customer_social_profiles.facebook_display_name) {
      return customer.customer_social_profiles.facebook_display_name;
    }
  }

  // 4. customer.social_profiles[0].facebook_display_name if alias exists
  if (Array.isArray(customer.social_profiles) && customer.social_profiles.length > 0) {
    for (const profile of customer.social_profiles) {
      if (profile?.facebook_display_name) return profile.facebook_display_name;
    }
  }

  return null;
}

export function getCustomerBusinessDisplayName(customer: CustomerShape | null | undefined): string | null {
  if (!customer) return null;

  const businessName = toSafeString(customer.business_name);
  if (businessName && !isUrlLike(businessName)) return businessName;

  const facilityName = toSafeString(customer.facility_name);
  if (facilityName && !isUrlLike(facilityName)) return facilityName;

  return null;
}

export function getCustomerPersonDisplayName(customer: CustomerShape | null | undefined): string {
  if (!customer) return "Khách chưa có tên";

  // 1. contact_name if not URL/UID
  const contactName = toSafeString(customer.contact_name);
  if (contactName && !isUrlLike(contactName) && !isUidLike(contactName)) {
    return contactName;
  }

  // 2. facebook_display_name
  const fbName = toSafeString(getFacebookDisplayNameFromCustomer(customer));
  if (fbName && !isUrlLike(fbName) && !isUidLike(fbName)) {
    return fbName;
  }

  // 3. name if not URL/UID
  const name = toSafeString(customer.name);
  if (name && !isUrlLike(name) && !isUidLike(name)) {
    return name;
  }

  // 4. phone
  const phone = toSafeString(customer.phone);
  if (phone && !isUidLike(phone) && !isUrlLike(phone)) return phone;

  // 5. fallback
  if (isUidLike(phone)) return "Khách Facebook chưa có tên";
  return "Khách chưa có tên";
}

export function getCustomerCardTitle(customer: CustomerShape | null | undefined): string {
  if (!customer) return "Khách chưa có tên";

  // 1. business/facility display name
  const businessName = getCustomerBusinessDisplayName(customer);
  if (businessName) return businessName;

  // 2. person display name
  const personName = getCustomerPersonDisplayName(customer);
  const phoneStr = toSafeString(customer.phone);
  if (personName !== "Khách chưa có tên" && personName !== phoneStr) return personName;

  // 3. phone
  if (phoneStr && !isUidLike(phoneStr) && !isUrlLike(phoneStr)) return phoneStr;

  // 4. fallback
  if (isUidLike(phoneStr)) return "Khách Facebook chưa có tên";
  return "Khách chưa có tên";
}

// Aliases for compatibility with existing imports, we will migrate them over if needed
export const getCustomerDisplayName = getCustomerPersonDisplayName;
export const getCustomerBusinessOrDisplayName = getCustomerCardTitle;
