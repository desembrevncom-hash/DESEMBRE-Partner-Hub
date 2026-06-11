export function isUrl(str: string | null | undefined): boolean {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  return s.includes("http") || s.includes("facebook.com") || s.includes("profile.php");
}

export function getCustomerDisplayName(customer: any): string {
  if (!customer) return "Khách hàng mới";

  // 1. contact_name / person_name / contact_person_name if exists and not URL
  if (customer.contact_name && !isUrl(customer.contact_name)) return customer.contact_name;
  if (customer.person_name && !isUrl(customer.person_name)) return customer.person_name;
  if (customer.contact_person_name && !isUrl(customer.contact_person_name)) return customer.contact_person_name;

  // 2. display_name if exists and not URL
  if (customer.display_name && !isUrl(customer.display_name)) return customer.display_name;

  // 3. name if exists and not URL
  if (customer.name && !isUrl(customer.name)) return customer.name;

  // 4. facebook_display_name from social profile if available
  // Assuming the customer object might be joined with customer_social_profiles,
  // or it might be passed as facebook_display_name directly if there's a view.
  if (customer.facebook_display_name && !isUrl(customer.facebook_display_name)) return customer.facebook_display_name;

  // 5. phone if available
  if (customer.phone) return customer.phone;

  // 6. fallback: raw current name/url only as last resort
  if (customer.contact_name) return customer.contact_name;
  if (customer.name) return customer.name;

  return "Khách hàng mới";
}
