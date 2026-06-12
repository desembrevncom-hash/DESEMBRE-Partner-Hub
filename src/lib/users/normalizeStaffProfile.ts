import { toSafeString } from "../utils/safeString";

export type NormalizedStaffProfile = {
  id: string; // Preserved raw
  display_name: string;
  full_name: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  
  // Entire raw row for edge cases
  raw: any;
  
  // Catch-all for other fields
  [key: string]: any;
};

export function normalizeStaffProfile(row: any): NormalizedStaffProfile {
  if (!row || typeof row !== 'object') {
    return {
      id: "",
      display_name: "",
      full_name: "",
      name: "",
      email: "",
      phone: "",
      role: "",
      raw: row,
    };
  }

  return {
    ...row, // Preserve all original fields
    
    // Override display fields with strict safe strings
    display_name: toSafeString(row.display_name),
    full_name: toSafeString(row.full_name),
    name: toSafeString(row.name),
    email: toSafeString(row.email),
    phone: toSafeString(row.phone),
    role: toSafeString(row.role),
    
    // Store original row reference
    raw: row,
  };
}
