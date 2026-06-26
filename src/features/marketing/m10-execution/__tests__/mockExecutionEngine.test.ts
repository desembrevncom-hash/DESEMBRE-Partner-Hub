import { describe, it, expect } from "vitest";
import { simulateMockExecution } from "../utils/mockExecutionEngine";
import { mockDispatchRows } from "../__fixtures__/mockDispatchRows";

describe("mockExecutionEngine", () => {
  it("aborts when gateway is disabled", () => {
    expect(() => simulateMockExecution(mockDispatchRows, false)).toThrowError(/GATEWAY_ABORT/);
  });

  it("simulates success, failure, and timeout according to payload", () => {
    const summary = simulateMockExecution(mockDispatchRows, true);
    expect(summary.processed).toBe(3);
    expect(summary.success).toBe(1);
    expect(summary.failed).toBe(2);

    // ZALO success
    expect(summary.results[0].success).toBe(true);
    expect(summary.results[0].maskedContact).toBe("+84******567");
    expect(summary.results[0].idempotencyKey).toBe("idem-custom-001");
    
    // EMAIL failure
    expect(summary.results[1].success).toBe(false);
    expect(summary.results[1].error).toContain("MOCK_PROVIDER_ERROR");
    expect(summary.results[1].maskedContact).toBe("cus***@example.com");
    expect(summary.results[1].idempotencyKey).toBe("disp-002_EMAIL_acc-email-1");
    
    // ZALO timeout
    expect(summary.results[2].success).toBe(false);
    expect(summary.results[2].error).toContain("MOCK_PROVIDER_TIMEOUT");
    expect(summary.results[2].simulatedTimeMs).toBe(5000);
  });

  it("ignores rows that are not status=ready", () => {
    const mixedRows = [
      ...mockDispatchRows,
      { ...mockDispatchRows[0], id: "disp-004", status: "sent" }
    ];
    const summary = simulateMockExecution(mixedRows, true);
    expect(summary.processed).toBe(3); // The 4th row is ignored
  });
});
