import { describe, it, expect } from "vitest";
import { maskContactValue } from "../utils/piiMasking";

describe("piiMasking", () => {
  it("masks phone numbers correctly", () => {
    expect(maskContactValue("+84901234567")).toBe("+84******567");
    expect(maskContactValue("0987654321")).toBe("098****321");
    expect(maskContactValue("123")).toBe("******");
  });

  it("masks emails correctly", () => {
    expect(maskContactValue("customer@example.com")).toBe("cus***@example.com");
    expect(maskContactValue("abc@gmail.com")).toBe("***@gmail.com");
  });

  it("handles empty values gracefully", () => {
    expect(maskContactValue("")).toBe("");
  });
});
