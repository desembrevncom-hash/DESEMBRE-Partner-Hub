import { describe, it, expect } from "vitest";
import { safeSearchIncludes, safeStripAccents } from "../src/lib/utils/safeString";
import { normalizeCustomerRow } from "../src/lib/customers/normalizeCustomer";
import { normalizeStaffProfile } from "../src/lib/users/normalizeStaffProfile";

describe("Route-Level Filtering Safety", () => {
  it("A. Province filter string array - must handle simple strings and not crash on missing .name", () => {
    const VIETNAM_PROVINCES = ["Hà Nội", "Ninh Bình", "Hồ Chí Minh"];
    const citySearch = "ninh";
    
    // The previous bug was VIETNAM_PROVINCES.filter(p => p.name.toLowerCase()...)
    // This test ensures safeSearchIncludes works directly on strings
    const result = VIETNAM_PROVINCES.filter(p => 
      safeSearchIncludes(safeStripAccents(p), safeStripAccents(citySearch))
    );
    
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Ninh Bình");
  });

  it("B. Undefined field in filter item - should not crash", () => {
    const items = [
      { label: undefined },
      { label: 12345 },
      { label: "Xuân Mai" }
    ];
    
    const search = "xuan";
    
    const result = items.filter(item => 
      safeSearchIncludes(safeStripAccents(item.label), safeStripAccents(search))
    );
    
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Xuân Mai");
  });

  it("C. Customer with undefined derived fields - filtering/searching does not crash", () => {
    const badCustomer = {
      name: "Lian Homespa",
      phone: 943597123,
      source: undefined,
      status: undefined,
      summary: undefined,
      notes: undefined
    };
    
    const nc = normalizeCustomerRow(badCustomer);
    
    // Simulating search logic
    const q = safeStripAccents("lian");
    const nameMatch = safeSearchIncludes(safeStripAccents(nc.name), q);
    const phoneMatch = safeSearchIncludes(nc.phone, q);
    
    expect(nameMatch).toBe(true);
    expect(phoneMatch).toBe(false);
    expect(nc.source).toBe("");
    expect(nc.summary).toBe("");
  });

  it("D. Staff/profile missing display name - no crash", () => {
    const badStaff = {
      display_name: undefined,
      email: undefined
    };
    
    const np = normalizeStaffProfile(badStaff);
    
    expect(np.display_name).toBe("");
    expect(np.email).toBe("");
    
    const searchResult = safeSearchIncludes(np.display_name, "test");
    expect(searchResult).toBe(false); // empty string includes "test" -> false
  });

  it("E. Full bad route data array - no toLowerCase crash", () => {
    const badRouteData = [
      undefined,
      null,
      { id: 1 },
      "string",
      1234
    ];
    
    // Simulate mapping over bad data
    const safeMapped = badRouteData.map(item => normalizeStaffProfile(item));
    
    // Ensure all became safe objects and no crashes occurred
    expect(safeMapped).toHaveLength(5);
    safeMapped.forEach(sm => {
      expect(typeof sm.display_name).toBe("string");
      expect(typeof sm.email).toBe("string");
      expect(safeSearchIncludes(sm.display_name, "foo")).toBe(false);
    });
  });
});
