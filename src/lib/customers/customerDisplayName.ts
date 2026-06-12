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

export function isUrlLike(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim().toLowerCase();
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.includes("www.facebook.com") ||
    s.includes("facebook.com/") ||
    s === "facebook.com" ||
    s.includes("m.facebook.com") ||
    s.includes("fb.com") ||
    s.includes("profile.php?id=")
  );
}

export function isUidLike(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim();
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

  if (customer.business_name && !isUrlLike(customer.business_name)) return customer.business_name;
  if (customer.facility_name && !isUrlLike(customer.facility_name)) return customer.facility_name;

  return null;
}

export function getCustomerPersonDisplayName(customer: CustomerShape | null | undefined): string {
  if (!customer) return "Khách chưa có tên";

  // 1. contact_name if not URL/UID
  if (customer.contact_name && !isUrlLike(customer.contact_name) && !isUidLike(customer.contact_name)) {
    return customer.contact_name;
  }

  // 2. facebook_display_name
  const fbName = getFacebookDisplayNameFromCustomer(customer);
  if (fbName && !isUrlLike(fbName) && !isUidLike(fbName)) {
    return fbName;
  }

  // 3. name if not URL/UID
  if (customer.name && !isUrlLike(customer.name) && !isUidLike(customer.name)) {
    return customer.name;
  }

  // 4. phone
  if (customer.phone) return customer.phone;

  // 5. fallback
  return "Khách chưa có tên";
}

export function getCustomerCardTitle(customer: CustomerShape | null | undefined): string {
  if (!customer) return "Khách chưa có tên";

  // 1. business/facility display name
  const businessName = getCustomerBusinessDisplayName(customer);
  if (businessName) return businessName;

  // 2. person display name
  const personName = getCustomerPersonDisplayName(customer);
  if (personName !== "Khách chưa có tên" && personName !== customer.phone) return personName;

  // 3. phone
  if (customer.phone) return customer.phone;

  // 4. fallback
  return "Khách chưa có tên";
}

// Aliases for compatibility with existing imports, we will migrate them over if needed
export const getCustomerDisplayName = getCustomerPersonDisplayName;
export const getCustomerBusinessOrDisplayName = getCustomerCardTitle;
