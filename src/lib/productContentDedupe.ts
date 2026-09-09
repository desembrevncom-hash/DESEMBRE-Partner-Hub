/**
 * Text normalization and content deduplication helpers for public product catalog & detail views.
 */

/**
 * Normalizes text for similarity comparison:
 * - Converts to lowercase
 * - Strips bullet symbols (-, *, •, 1.)
 * - Removes non-alphanumeric punctuation
 * - Collapses multiple spaces
 */
export function normalizeTextForCompare(value: string | undefined | null): string {
  if (!value || typeof value !== "string") return "";
  return value
    .toLowerCase()
    .replace(/^[-*•\d.]+\s*/gm, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Determines whether two content blocks (e.g. product_characteristics vs benefits or description)
 * are too similar to warrant rendering both in the public product detail modal.
 *
 * Compares exact string matches, substring containment, and token overlap similarity (>= 0.7).
 */
export function isSimilarContent(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  const normA = normalizeTextForCompare(a);
  const normB = normalizeTextForCompare(b);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Substring containment for substantial texts (>= 15 chars)
  const minLen = Math.min(normA.length, normB.length);
  if (minLen >= 15 && (normA.includes(normB) || normB.includes(normA))) {
    return true;
  }

  // Token overlap similarity
  const tokensA = new Set(normA.split(" ").filter((t) => t.length > 1));
  const tokensB = new Set(normB.split(" ").filter((t) => t.length > 1));

  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let commonCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      commonCount++;
    }
  }

  const smallerSize = Math.min(tokensA.size, tokensB.size);
  const overlapRatio = commonCount / smallerSize;

  return overlapRatio >= 0.7;
}
