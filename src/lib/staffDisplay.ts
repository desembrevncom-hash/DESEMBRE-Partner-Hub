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
    if (profile.display_name && profile.display_name.trim() !== "") {
      return profile.display_name;
    }
    if (profile.email && profile.email.trim() !== "") {
      return profile.email;
    }
  }

  // Fallback to first 6 chars of ID if no profile found
  return `Staff-${userId.slice(0, 6)}`;
}

/**
 * Get initials of the staff member for small avatars.
 */
export function getStaffInitials(userId?: string | null, staffMap?: StaffMap): string {
  if (!userId) return "S"; // Fallback to "S"

  if (staffMap && staffMap[userId]) {
    const profile = staffMap[userId];
    const name = profile.display_name || profile.email;
    if (name && name.trim() !== "") {
      const parts = name.trim().split(/\s+/);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        return lastPart.charAt(0).toUpperCase();
      }
    }
  }

  return "S";
}
