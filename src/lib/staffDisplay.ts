import { getEmailLocalPart, getInitials, getSafeDisplayName } from "./utils/safeEmail";
import { safeTrim, toSafeString } from "./utils/safeString";

export interface StaffProfile {
  id: string;
  display_name?: string | null;
  email?: string | null;
}

export type StaffMap = Record<string, { display_name?: string | null; email?: string | null }>;

/**
 * Builds a lookup map from an array of profiles for O(1) retrieval.
 */
export function buildStaffMap(profiles: StaffProfile[] | null | undefined): StaffMap {
  const map: StaffMap = {};
  if (!profiles) return map;
  profiles.forEach((p) => {
    if (p && p.id) {
      map[p.id] = {
        display_name: p.display_name,
        email: p.email,
      };
    }
  });
  return map;
}

/**
 * Get display name for a staff member using the staff map.
 * Fallbacks are implemented according to requirements:
 * - Empty/null/undefined userId -> "Chưa phân công"
 * - display_name exists -> display_name
 * - email exists -> email
 * - No profile -> "Staff-{6 chars of ID}"
 */
export function getStaffDisplayName(userId?: string | null, staffMap?: StaffMap): string {
  if (!userId) return "Chưa phân công";

  if (staffMap && staffMap[userId]) {
    const profile = staffMap[userId];
    const dName = safeTrim(profile.display_name);
    if (dName) {
      return dName;
    }
    const eName = safeTrim(profile.email);
    if (eName) {
      return getEmailLocalPart(eName);
    }
  }

  // Fallback to first 6 chars of ID if no profile found
  return `Staff-${toSafeString(userId).slice(0, 6)}`;
}

/**
 * Get initials of the staff member for small avatars.
 */
export function getStaffInitials(userId?: string | null, staffMap?: StaffMap): string {
  if (!userId) return "S";

  if (staffMap && staffMap[userId]) {
    const profile = staffMap[userId];
    const name = safeTrim(profile.display_name) || safeTrim(profile.email);
    if (name) {
      return getInitials(name);
    }
  }

  return "S";
}
