/**
 * Parse Facebook URL to extract UID, Username, and normalize it.
 * Covers:
 * - profile.php?id=...
 * - /people/name/id
 * - facebook.com/username
 * - m.facebook.com
 * - fb.com
 * - strips tracking params like mibextid
 */

export interface ParsedFacebookProfile {
  rawUrl: string;
  normalizedUrl: string | null;
  facebookUid: string | null;
  facebookUsername: string | null;
  isNumericUid: boolean;
}

export function parseFacebookUrl(url: string): ParsedFacebookProfile {
  const result: ParsedFacebookProfile = {
    rawUrl: url,
    normalizedUrl: null,
    facebookUid: null,
    facebookUsername: null,
    isNumericUid: false,
  };

  if (!url || typeof url !== "string") {
    return result;
  }

  try {
    // Add protocol if missing to make it a valid URL for parsing
    const urlString = url.startsWith("http") ? url : `https://${url}`;
    const parsed = new URL(urlString);

    // Ensure it's a Facebook domain
    if (!parsed.hostname.match(/(facebook\.com|fb\.com)$/i)) {
      return result;
    }

    // 1. profile.php?id=123456
    if (parsed.pathname === "/profile.php") {
      const id = parsed.searchParams.get("id");
      if (id && /^\d+$/.test(id)) {
        result.facebookUid = id;
        result.isNumericUid = true;
        result.normalizedUrl = `https://facebook.com/profile.php?id=${id}`;
        return result;
      }
    }

    // 2. /people/Name/123456
    const peopleMatch = parsed.pathname.match(/^\/people\/[^\/]+\/(\d+)\/?/);
    if (peopleMatch && peopleMatch[1]) {
      result.facebookUid = peopleMatch[1];
      result.isNumericUid = true;
      result.normalizedUrl = `https://facebook.com/profile.php?id=${result.facebookUid}`;
      return result;
    }

    // 3. facebook.com/username or facebook.com/username/
    const pathParts = parsed.pathname.split("/").filter((p) => p.length > 0);
    if (pathParts.length > 0) {
      // Avoid matching special paths
      const reservedPaths = ["groups", "events", "pages", "watch", "marketplace", "gaming", "jobs", "home.php"];
      const username = pathParts[0];

      if (!reservedPaths.includes(username.toLowerCase())) {
        // Is it purely numeric? Some people have numeric usernames or old profile links like fb.com/123456
        if (/^\d+$/.test(username)) {
          result.facebookUid = username;
          result.isNumericUid = true;
          result.normalizedUrl = `https://facebook.com/profile.php?id=${result.facebookUid}`;
        } else {
          result.facebookUsername = username;
          result.normalizedUrl = `https://facebook.com/${username}`;
        }
      }
    }
  } catch (error) {
    // Invalid URL format, fail silently and return raw URL
  }

  return result;
}
