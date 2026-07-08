/**
 * Normalizes a Vietnamese phone number to canonical E.164 format (+84xxxxxxxxx).
 *
 * Rules:
 * - Removes spaces, dashes, periods, and parentheses.
 * - Handles inputs with or without '+84' prefix.
 * - Handles inputs with '84' prefix.
 * - Handles inputs with '0' prefix.
 * - Validates against valid Vietnamese mobile prefixes (03, 05, 07, 08, 09).
 * - Returns null if the phone number is invalid.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Remove all non-numeric characters except leading '+'
  let digits = phone.replace(/[^\d+]/g, '');

  // Handle various prefixes
  if (digits.startsWith('+84')) {
    digits = digits.substring(3);
  } else if (digits.startsWith('84') && digits.length === 11) {
    // Exact length check helps avoid treating '84...' local numbers (if they existed) incorrectly,
    // but in Vietnam 11 digits starting with 84 means it includes the country code.
    digits = digits.substring(2);
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1);
  } else {
    // No recognized prefix (like missing +84 or 0).
    // We only accept valid 9-digit subscriber numbers here.
  }

  // A valid Vietnamese mobile number (after removing +84 or 0) must be exactly 9 digits
  if (digits.length !== 9) return null;

  // It must start with 3, 5, 7, 8, or 9
  const validPrefixes = ['3', '5', '7', '8', '9'];
  if (!validPrefixes.includes(digits[0])) return null;

  return `+84${digits}`;
}
