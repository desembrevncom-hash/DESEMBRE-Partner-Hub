import { toSafeString } from "../utils/safeString";

export type NormalizedCustomer = {
  id: string; // Preserved raw
  name: string;
  contact_name: string;
  business_name: string;
  facility_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  source: string;
  status: string;
  notes: string;
  summary: string;
  facebook_display_name: string;
  
  // Non-display fields preserved as-is
  created_at?: string;
  updated_at?: string;
  latitude?: number | null;
  longitude?: number | null;
  owner_sale_id?: string | null;
  owner_tele_id?: string | null;
  assigned_user_id?: string | null;
  created_by?: string | null;
  metrics?: any;
  flags?: any;
  
  // Entire raw row for edge cases
  raw: any;
  
  // Catch-all for other fields
  [key: string]: any;
};

export function normalizeCustomerRow(row: any): NormalizedCustomer {
  if (!row || typeof row !== 'object') {
    return {
      id: "",
      name: "",
      contact_name: "",
      business_name: "",
      facility_name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      province: "",
      source: "",
      status: "",
      notes: "",
      summary: "",
      facebook_display_name: "",
      raw: row,
    };
  }

  return {
    ...row, // Preserve all original fields
    
    // Override display fields with strict safe strings
    name: toSafeString(row.name),
    contact_name: toSafeString(row.contact_name),
    business_name: toSafeString(row.business_name),
    facility_name: toSafeString(row.facility_name),
    phone: toSafeString(row.phone),
    email: toSafeString(row.email),
    address: toSafeString(row.address),
    city: toSafeString(row.city),
    province: toSafeString(row.province),
    source: toSafeString(row.source),
    status: toSafeString(row.status),
    notes: toSafeString(row.notes),
    summary: toSafeString(row.summary),
    facebook_display_name: toSafeString(row.facebook_display_name),
    
    // Store original row reference
    raw: row,
  };
}
