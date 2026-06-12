import { describe, it, expect } from "vitest";
import { toSafeString, safeLower, safeDigits } from "../src/lib/utils/safeString";
import { getEmailLocalPart, getInitials, getSafeDisplayName } from "../src/lib/utils/safeEmail";
import { isUrlLike, isUidLike, getCustomerCardTitle } from "../src/lib/customers/customerDisplayName";
import { formatPhoneForDisplay, formatPhoneForCallHref, formatPhoneForZalo } from "../src/lib/customers/phoneUtils";
import { normalizeCustomerRow } from "../src/lib/customers/normalizeCustomer";

describe("Customer String Safety Hardening", () => {
  describe("A. safeString utilities", () => {
    it("safely casts values", () => {
      expect(toSafeString(null)).toBe("");
      expect(toSafeString(undefined)).toBe("");
      expect(toSafeString(12345)).toBe("12345");
      expect(toSafeString(true)).toBe("true");
      expect(toSafeString({})).toBe("");
      expect(toSafeString([])).toBe("");
    });
    it("safeLower gracefully handles numbers", () => {
      expect(safeLower(12345)).toBe("12345");
    });
    it("safeDigits extracts digits", () => {
      expect(safeDigits("09a43-597-123")).toBe("0943597123");
      expect(safeDigits(12345)).toBe("12345");
    });
  });

  describe("B. customerDisplayName safe string validation", () => {
    it("isUrlLike gracefully rejects numbers", () => {
      expect(isUrlLike(12345)).toBe(false);
      expect(isUrlLike("https://facebook.com/xuan.mai")).toBe(true);
    });
    it("isUidLike correctly parses numbers without throwing", () => {
      expect(isUidLike(943597123)).toBe(false);
      expect(isUidLike("0943597123")).toBe(false);
      expect(isUidLike("100072641176190")).toBe(true);
    });
  });

  describe("C. getCustomerCardTitle with numeric legacy fields", () => {
    it("handles deeply numeric data seamlessly", () => {
      const fixture = {
        name: 123456789012345,
        phone: 943597123,
        business_name: null,
        contact_name: null,
      };
      // 123456789012345 is > 12 chars so isUidLike handles it and it skips name. phone is fallback.
      expect(getCustomerCardTitle(fixture)).toBe("943597123");
    });
  });

  describe("D. numeric business name", () => {
    it("uses business_name safely", () => {
      const fixture = {
        business_name: 12345,
        phone: 943597123,
      };
      expect(getCustomerCardTitle(fixture)).toBe("12345");
    });
  });

  describe("E. Facebook URL + numeric phone", () => {
    it("prioritizes contact_name over FB URL", () => {
      const fixture = {
        name: "https://facebook.com/xuan.mai",
        contact_name: "Xuân Mai",
        phone: 963123456,
      };
      expect(getCustomerCardTitle(fixture)).toBe("Xuân Mai");
    });
  });

  describe("F. phoneUtils formatting", () => {
    it("formats phones for display without slice crash", () => {
      expect(formatPhoneForDisplay(943597123)).toBe("*****7123");
      expect(formatPhoneForDisplay(null)).toBe("");
    });
    it("formats href safely", () => {
      expect(formatPhoneForCallHref(943597123)).toBe("tel:943597123");
      expect(formatPhoneForCallHref(null)).toBeNull();
    });
    it("formats Zalo safely", () => {
      expect(formatPhoneForZalo(943597123)).toBe("https://zalo.me/943597123");
      expect(formatPhoneForZalo(null)).toBeNull();
    });
  });

  describe("G. User/Staff Display Hardening", () => {
    it("A. saleName numeric", () => {
      expect(getInitials(12345)).toBe("1");
      expect(getSafeDisplayName(12345, "Sale")).toBe("12345");
    });
    it("B. saleName object", () => {
      expect(getInitials({})).toBe("?");
      expect(getSafeDisplayName({}, "Sale")).toBe("Sale");
    });
  });

  describe("H. Safe Email", () => {
    it("C. numeric email", () => {
      expect(getEmailLocalPart(12345)).toBe("");
      expect(getEmailLocalPart("test@domain.com")).toBe("test");
      expect(getEmailLocalPart(null)).toBe("");
    });
  });

  describe("I. Data Boundary Normalization", () => {
    it("D. full bad customer row", () => {
      const row = {
        id: "test-id",
        name: 123456789012345,
        contact_name: null,
        business_name: 12345,
        facility_name: undefined,
        phone: 943597123,
        email: 12345,
        address: {},
        city: null,
        province: undefined,
        summary: 67890,
        notes: {},
        source: null,
        status: true
      };

      const normalized = normalizeCustomerRow(row);
      
      // normalizeCustomerRow does not crash
      expect(normalized.name).toBe("123456789012345");
      expect(normalized.contact_name).toBe("");
      expect(normalized.business_name).toBe("12345");
      expect(normalized.email).toBe("12345");
      expect(normalized.notes).toBe("");
      expect(normalized.id).toBe("test-id");

      // getCustomerCardTitle does not crash
      expect(getCustomerCardTitle(normalized)).toBe("12345");

      // search helper does not crash (mimicking search map)
      expect(safeLower(normalized.name).includes("123")).toBe(true);

      // CSV export does not crash
      expect(toSafeString(normalized.facility_name).replace(/"/g, '""')).toBe("");

      // phone action helpers do not crash
      expect(formatPhoneForDisplay(normalized.phone)).toBe("*****7123");
      expect(formatPhoneForCallHref(normalized.phone)).toBe("tel:943597123");
      
      // email helper does not crash
      expect(getEmailLocalPart(normalized.email)).toBe("");
    });
  });
});
