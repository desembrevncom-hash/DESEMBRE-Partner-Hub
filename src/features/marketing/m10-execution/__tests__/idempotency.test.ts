import { describe, it, expect } from "vitest";
import { generateIdempotencyKey } from "../utils/idempotency";

describe("idempotency", () => {
  it("uses existing key if provided", () => {
    expect(generateIdempotencyKey("idem-123", "d-1", "EMAIL", "acc-1")).toBe("idem-123");
  });

  it("generates fallback key if existing key is missing", () => {
    expect(generateIdempotencyKey(null, "d-1", "ZALO_ZNS", "acc-1")).toBe("d-1_ZALO_ZNS_acc-1");
    expect(generateIdempotencyKey("", "d-1", "ZALO_ZNS", "acc-1")).toBe("d-1_ZALO_ZNS_acc-1");
  });
  
  it("never relies on attempt_count", () => {
    // Contract ensures attempt_count is not even an argument
    expect(generateIdempotencyKey(null, "d-1", "ZALO", "acc-1")).toBe("d-1_ZALO_acc-1");
  });
});
