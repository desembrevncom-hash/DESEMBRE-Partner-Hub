import { toSafeString, safeTrim } from "./safeString";

export function getEmailLocalPart(value: unknown): string {
  const str = toSafeString(value);
  if (!str) return "";
  if (!str.includes("@")) return ""; // If it doesn't look like an email, don't show it
  return str.split("@")[0];
}

export function getSafeDisplayName(value: unknown, fallback: string = "?"): string {
  const str = safeTrim(value);
  return str || fallback;
}

export function getInitials(value: unknown): string {
  const str = safeTrim(value);
  if (!str) return "?";
  
  // Split by space safely
  const parts = str.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  
  // Return the first character of the first word
  // Or maybe first char of first word + first char of last word if length > 1
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
