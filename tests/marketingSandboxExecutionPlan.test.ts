import { describe, it, expect } from "vitest";
import { getSandboxExecutionPlan } from "../src/lib/marketing/sandboxExecutionPlan";
import { readFileSync } from "fs";
import { join } from "path";

describe("M26 Controlled Sandbox Execution Design", () => {
  it("should never have current_execution_mode as real_send", () => {
    const plans = getSandboxExecutionPlan();
    plans.forEach((plan) => {
      expect(plan.current_execution_mode).not.toBe("real_send");
    });
  });

  it("should mark resend and zalo as sandbox_blocked", () => {
    const plans = getSandboxExecutionPlan();
    
    const resend = plans.find((p) => p.provider_id === "resend");
    expect(resend?.current_execution_mode).toBe("sandbox_blocked");

    const zalo = plans.find((p) => p.provider_id === "zalo_zns");
    expect(zalo?.current_execution_mode).toBe("sandbox_blocked");
  });

  it("should mark mock as dry_run_only", () => {
    const plans = getSandboxExecutionPlan();
    const mock = plans.find((p) => p.provider_id === "mock");
    expect(mock?.current_execution_mode).toBe("dry_run_only");
  });

  it("should enforce strict safety boundaries", () => {
    const plans = getSandboxExecutionPlan();
    plans.forEach((plan) => {
      expect(plan.provider_api_called).toBe(false);
      expect(plan.real_send_enabled).toBe(false);
      expect(plan.external_provider_calls_enabled).toBe(false);
      expect(plan.production_gate_open).toBe(false);
    });
  });

  it("helper source code should not contain unsafe API or env calls", () => {
    const sourceCode = readFileSync(
      join(__dirname, "../src/lib/marketing/sandboxExecutionPlan.ts"),
      "utf8"
    );

    expect(sourceCode).not.toContain("import.meta.env");
    expect(sourceCode).not.toContain("process.env");
    expect(sourceCode).not.toContain("Deno.env");
    expect(sourceCode).not.toContain("fetch(");
    
    // Ensure no provider libraries are called
    expect(sourceCode).not.toContain("new Resend(");
    expect(sourceCode).not.toContain("zalo.com/api");

    // Ensure no secret patterns leaked
    expect(sourceCode.toLowerCase()).not.toContain("sk-");
  });
});
