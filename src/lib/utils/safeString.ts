export function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" || typeof value === "function") return "";
  return "";
}

export function safeTrim(value: unknown): string {
  return toSafeString(value).trim();
}

export function safeLower(value: unknown): string {
  return toSafeString(value).toLowerCase();
}

export function safeIncludes(value: unknown, query: unknown): boolean {
  const safeVal = toSafeString(value);
  const safeQ = toSafeString(query);
  if (!safeQ.trim()) return true; // consistent with caller behavior
  return safeVal.includes(safeQ);
}

export function safeDigits(value: unknown): string {
  return toSafeString(value).replace(/[^\d]/g, "");
}

export function safeSearchIncludes(value: unknown, query: unknown): boolean {
  const text = safeLower(value);
  const q = safeTrim(safeLower(query));
  if (!q) return true;
  return text.includes(q);
}

export function safeStripAccents(value: unknown): string {
  const safeStr = toSafeString(value);
  if (!safeStr) return "";
  return safeStr
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}
