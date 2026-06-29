import { describe, it, expect } from "vitest";
import { evaluateSandboxExecution } from "../src/lib/marketing/sandboxExecutionController";
import { readFileSync } from "fs";
import { join } from "path";

describe("M27 Controlled Sandbox Execution Controller", () => {
  it("should enforce strict safety boundaries universally", () => {
    const resultMock = evaluateSandboxExecution({
      provider_id: "mock",
      channel: "email",
      recipient: "test@desembre.vn",
      requested_by_role: "admin",
      sandbox_mode_requested: true,
    });
    const resultResend = evaluateSandboxExecution({
      provider_id: "resend",
      channel: "email",
      recipient: "test@desembre.vn",
      requested_by_role: "admin",
      sandbox_mode_requested: true,
    });
    const resultZalo = evaluateSandboxExecution({
      provider_id: "zalo_zns",
      channel: "zalo",
      recipient: "0001234567",
      requested_by_role: "admin",
      sandbox_mode_requested: true,
    });

    [resultMock, resultResend, resultZalo].forEach((result) => {
      expect(result.provider_api_called).toBe(false);
      expect(result.real_send_enabled).toBe(false);
      expect(result.external_provider_calls_enabled).toBe(false);
      expect(result.production_gate_open).toBe(false);
      expect(result.approval_required).toBe(true);
    });
  });

  it("mock should return synthetic_message_id and mock_sandbox_executed only for valid requests", () => {
    // Valid request
    const result = evaluateSandboxExecution({
      provider_id: "mock",
      channel: "email",
      recipient: "test@desembre.vn",
      requested_by_role: "admin",
      sandbox_mode_requested: true,
    });
    expect(result.execution_mode).toBe("mock_sandbox_executed");
    expect(result.synthetic_message_id).toContain("mock-msg-");

    // Invalid recipient
    const invalidRecipient = evaluateSandboxExecution({
      provider_id: "mock",
      channel: "email",
      recipient: "real@customer.com",
      requested_by_role: "admin",
      sandbox_mode_requested: true,
    });
    expect(invalidRecipient.execution_mode).toBe("dry_run_only");
    expect(invalidRecipient.synthetic_message_id).toBeUndefined();

    // Sandbox not requested
    const notRequested = evaluateSandboxExecution({
      provider_id: "mock",
      channel: "email",
      recipient: "test@desembre.vn",
      requested_by_role: "admin",
      sandbox_mode_requested: false,
    });
    expect(notRequested.execution_mode).toBe("dry_run_only");
    expect(notRequested.synthetic_message_id).toBeUndefined();
  });

  it("resend should always return sandbox_blocked and null message id", () => {
    const result = evaluateSandboxExecution({
      provider_id: "resend",
      channel: "email",
      recipient: "test@desembre.vn",
      requested_by_role: "admin",
      sandbox_mode_requested: true,
    });
    expect(result.execution_mode).toBe("sandbox_blocked");
    expect(result.provider_message_id).toBeNull();
  });

  it("zalo_zns should always return sandbox_blocked and null message id", () => {
    const result = evaluateSandboxExecution({
      provider_id: "zalo_zns",
      channel: "zalo",
      recipient: "0001234567",
      requested_by_role: "admin",
      sandbox_mode_requested: true,
    });
    expect(result.execution_mode).toBe("sandbox_blocked");
    expect(result.provider_message_id).toBeNull();
  });

  it("helper source code should not contain unsafe API or env calls", () => {
    const sourceCode = readFileSync(
      join(__dirname, "../src/lib/marketing/sandboxExecutionController.ts"),
      "utf8"
    );

    expect(sourceCode).not.toContain("import.meta.env");
    expect(sourceCode).not.toContain("process.env");
    expect(sourceCode).not.toContain("Deno.env");
    expect(sourceCode).not.toContain("fetch(");
    
    // Ensure no provider libraries are called
    expect(sourceCode).not.toContain("new Resend(");
    expect(sourceCode).not.toContain("zalo.com/api");
    expect(sourceCode).not.toContain("import { Resend");
    
    // Ensure no secret patterns leaked
    expect(sourceCode.toLowerCase()).not.toContain("sk-");
  });
});
