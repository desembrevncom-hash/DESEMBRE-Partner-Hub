export const MAP_OWNER_PALETTE = [
  { color: "bg-blue-600", ring: "ring-blue-100" },
  { color: "bg-emerald-600", ring: "ring-emerald-100" },
  { color: "bg-violet-600", ring: "ring-violet-100" },
  { color: "bg-amber-600", ring: "ring-amber-100" },
  { color: "bg-rose-600", ring: "ring-rose-100" },
  { color: "bg-cyan-700", ring: "ring-cyan-100" },
  { color: "bg-orange-600", ring: "ring-orange-100" },
  { color: "bg-indigo-600", ring: "ring-indigo-100" },
  { color: "bg-teal-600", ring: "ring-teal-100" },
  { color: "bg-pink-600", ring: "ring-pink-100" },
];

export const FREE_POOL_COLOR = { color: "bg-slate-400", ring: "ring-slate-100" };

/**
 * Generates a deterministic integer from a string (like a UUID)
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Returns a deterministic color object from the palette based on ownerSaleId.
 * Returns gray color if no owner is provided.
 */
export function getSaleMarkerColor(ownerSaleId: string | null | undefined): {
  color: string;
  ring: string;
} {
  if (!ownerSaleId) {
    return FREE_POOL_COLOR;
  }
  const index = hashString(ownerSaleId) % MAP_OWNER_PALETTE.length;
  return MAP_OWNER_PALETTE[index];
}
