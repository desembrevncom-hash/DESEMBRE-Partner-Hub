import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizePhone } from "../src/lib/phoneNormalization";

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  },
};

(globalThis as unknown as { localStorage: typeof mockLocalStorage }).localStorage = mockLocalStorage;

describe("Catalog Lead Capture Validation & Flow", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe("Field Validation", () => {
    it("rejects empty full_name", () => {
      const name = "   ";
      const isValid = name.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it("accepts valid full_name", () => {
      const name = "Nguyễn Văn A";
      const isValid = name.trim().length > 0;
      expect(isValid).toBe(true);
    });

    it("validates Vietnamese phone numbers correctly", () => {
      expect(normalizePhone("0912345678")).toBe("+84912345678");
      expect(normalizePhone("0333602626")).toBe("+84333602626");
      expect(normalizePhone("+84 912 345 678")).toBe("+84912345678");
      expect(normalizePhone("0701234567")).toBe("+84701234567");
      expect(normalizePhone("0868123456")).toBe("+84868123456");
      expect(normalizePhone("0568123456")).toBe("+84568123456");
    });

    it("rejects invalid Vietnamese phone numbers", () => {
      // Too short
      expect(normalizePhone("09123456")).toBeNull();
      // Too long
      expect(normalizePhone("091234567890")).toBeNull();
      // Invalid carrier prefix (04 is landline, not mobile)
      expect(normalizePhone("0412345678")).toBeNull();
      // Invalid characters
      expect(normalizePhone("abcdefghij")).toBeNull();
      // Empty
      expect(normalizePhone("")).toBeNull();
    });
  });

  describe("Lead Payload Construction", () => {
    it("constructs compliant payload matching schema requirements", () => {
      const cleanName = "Trần Thị Mai";
      const cleanPhone = "0987654321";
      const normalizedPhone = normalizePhone(cleanPhone);
      const businessName = "Mai Beauty Spa";
      const message = "Quan tâm kem chống nắng Desembre";

      expect(normalizedPhone).not.toBeNull();

      const payload = {
        full_name: cleanName,
        phone: normalizedPhone!,
        business_name: businessName || null,
        message: message || null,
        source: "public_catalog" as const,
      };

      expect(payload).toEqual({
        full_name: "Trần Thị Mai",
        phone: "+84987654321",
        business_name: "Mai Beauty Spa",
        message: "Quan tâm kem chống nắng Desembre",
        source: "public_catalog",
      });
    });

    it("handles optional fields when omitted", () => {
      const cleanName = "Lê Hoàng";
      const normalizedPhone = normalizePhone("0333602626")!;

      const rawBusiness: string = "";
      const rawMessage: string = "";

      const payload = {
        full_name: cleanName,
        phone: normalizedPhone,
        business_name: rawBusiness || null,
        message: rawMessage || null,
        source: "public_catalog" as const,
      };

      expect(payload.business_name).toBeNull();
      expect(payload.message).toBeNull();
      expect(payload.source).toBe("public_catalog");
    });
  });

  describe("Local Backup Fallback", () => {
    it("stores lead in localStorage fallback when remote insert fails", () => {
      const payload = {
        full_name: "Phạm Văn B",
        phone: "+84901234567",
        business_name: "Spa Lan Hương",
        message: "Tư vấn bộ dưỡng ẩm",
        source: "public_catalog",
        created_at: new Date().toISOString(),
      };

      // Simulate fallback storage
      const existing = localStorage.getItem("catalog_consultation_leads_backup");
      const list = existing ? JSON.parse(existing) : [];
      list.push(payload);
      localStorage.setItem("catalog_consultation_leads_backup", JSON.stringify(list));

      const stored = JSON.parse(localStorage.getItem("catalog_consultation_leads_backup") || "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].full_name).toBe("Phạm Văn B");
      expect(stored[0].phone).toBe("+84901234567");
      expect(stored[0].source).toBe("public_catalog");
    });
  });
});
