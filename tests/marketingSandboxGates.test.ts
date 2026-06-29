import { describe, it, expect } from "vitest";
import { evaluateSandboxGates, GateContext } from "../supabase/functions/marketing-sandbox-send/gates";

describe("Marketing Sandbox Send Gates", () => {
  const getValidContext = (): GateContext => ({
    supabaseUrl: "https://wmhfvggbthyikqvlyqup.supabase.co",
    isSandboxModeEnabled: true,
    resendApiKey: "re_fake123",
    resendFromEmail: "test@desembre.vn",
    resendAllowlist: "allowed@example.com,test@example.com",
    userRole: "admin",
    job: {
      id: "job123",
      approved_by: "user123",
      channel: "email",
      provider: "resend",
      recipient_email: "allowed@example.com",
      status: "queued"
    }
  });

  it("should pass valid sandbox context", () => {
    const ctx = getValidContext();
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(true);
  });

  it("should block Production ref", () => {
    const ctx = getValidContext();
    ctx.supabaseUrl = "https://xhfqjupiidexvlltstal.supabase.co";
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("invalid_environment");
  });

  it("should block missing Staging ref", () => {
    const ctx = getValidContext();
    ctx.supabaseUrl = "https://other.supabase.co";
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("invalid_environment");
  });

  it("should block missing sandbox mode", () => {
    const ctx = getValidContext();
    ctx.isSandboxModeEnabled = false;
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("sandbox_disabled");
  });

  it("should block missing secrets", () => {
    const ctx = getValidContext();
    ctx.resendApiKey = undefined;
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("missing_secrets");
  });

  it("should block non-admin roles", () => {
    const ctx = getValidContext();
    ctx.userRole = "sale";
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("forbidden");
  });

  it("should block unapproved jobs", () => {
    const ctx = getValidContext();
    ctx.job.approved_by = null;
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("not_approved");
  });

  it("should block non-allowlisted recipients", () => {
    const ctx = getValidContext();
    ctx.job.recipient_email = "hacker@evil.com";
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("recipient_not_allowlisted");
  });

  it("should block Zalo and other non-email channels", () => {
    const ctx = getValidContext();
    ctx.job.channel = "zalo";
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("channel_blocked");
  });

  it("should return already_sent without calling provider", () => {
    const ctx = getValidContext();
    ctx.job.status = "sent";
    const result = evaluateSandboxGates(ctx);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("already_sent");
  });
});
