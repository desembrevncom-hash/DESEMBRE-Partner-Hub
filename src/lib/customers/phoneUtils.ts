import { toSafeString, safeDigits } from "../utils/safeString";
import type { CustomerShape } from "./customerDisplayName";

export function getCustomerPrimaryPhone(customer: CustomerShape | null | undefined): string {
  if (!customer) return "";
  return toSafeString(customer.phone || customer.primary_phone);
}

export function formatPhoneForDisplay(value: unknown): string {
  const safeStr = toSafeString(value);
  if (!safeStr) return "";
  return safeStr.slice(-4).padStart(safeStr.length, "*");
}

export function formatPhoneForCallHref(value: unknown): string | null {
  const digits = safeDigits(value);
  if (!digits) return null;
  return `tel:${digits}`;
}

export function formatPhoneForZalo(value: unknown): string | null {
  const digits = safeDigits(value);
  if (!digits) return null;
  return `https://zalo.me/${digits}`;
}
