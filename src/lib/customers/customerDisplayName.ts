export function isUrlLike(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim().toLowerCase();
  return (
    s.includes("http://") ||
    s.includes("https://") ||
    s.includes("facebook.com") ||
    s.includes("fb.com") ||
    s.includes("profile.php")
  );
}

export function getCustomerPersonDisplayName(customer: any): string {
  if (!customer) return "Khách chưa có tên";

  // 1. contact_name if non-empty and not URL
  if (customer.contact_name && !isUrlLike(customer.contact_name)) return customer.contact_name;
  
  // 2. person_name / contact_person_name if exists and not URL
  if (customer.person_name && !isUrlLike(customer.person_name)) return customer.person_name;
  if (customer.contact_person_name && !isUrlLike(customer.contact_person_name)) return customer.contact_person_name;

  // 3. display_name if exists and not URL
  if (customer.display_name && !isUrlLike(customer.display_name)) return customer.display_name;

  // 4. facebook_display_name from joined social profile if available
  if (customer.facebook_display_name && !isUrlLike(customer.facebook_display_name)) return customer.facebook_display_name;

  // 5. name if non-empty and not URL
  if (customer.name && !isUrlLike(customer.name)) return customer.name;

  // 6. phone if available
  if (customer.phone) return customer.phone;

  // 7. fallback
  return "Khách chưa có tên";
}

export function getCustomerBusinessDisplayName(customer: any): string | null {
  if (!customer) return null;

  if (customer.business_name && !isUrlLike(customer.business_name)) return customer.business_name;
  if (customer.spa_name && !isUrlLike(customer.spa_name)) return customer.spa_name;
  if (customer.company_name && !isUrlLike(customer.company_name)) return customer.company_name;
  if (customer.clinic_name && !isUrlLike(customer.clinic_name)) return customer.clinic_name;
  if (customer.facility_name && !isUrlLike(customer.facility_name)) return customer.facility_name;

  return null;
}

export function getCustomerCardTitle(customer: any): string {
  if (!customer) return "Khách chưa có tên";

  // 1. business display name if exists and is real
  const businessName = getCustomerBusinessDisplayName(customer);
  if (businessName) return businessName;

  // 2. person display name (will return phone or fallback if no real name)
  const personName = getCustomerPersonDisplayName(customer);
  if (personName !== "Khách chưa có tên") return personName;

  // 3. fallback to URL only as absolute last resort if absolutely nothing else exists,
  // but spec says: "Do NOT return Facebook URL from getCustomerCardTitle unless absolutely no other data exists."
  if (customer.contact_name) return customer.contact_name;
  if (customer.name) return customer.name;

  return "Khách chưa có tên";
}

// Aliases for compatibility with existing imports, we will migrate them over
export const getCustomerDisplayName = getCustomerPersonDisplayName;
export const getCustomerBusinessOrDisplayName = getCustomerCardTitle;
