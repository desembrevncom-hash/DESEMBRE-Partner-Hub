import { describe, it, expect } from "vitest";
import { 
  simulateAutomationScheduler, 
  SimulatorRecipientInput,
  AutomationWorkflowConfig 
} from "../src/lib/marketing/automationSchedulerSimulator";
import { MarketingSafetySettings } from "../src/lib/marketing/safetyRules";

describe("M41 Automation Scheduler Simulator v2", () => {
  const defaultSafety: MarketingSafetySettings = {
    global_kill_switch: false,
    email_enabled: true,
    zalo_enabled: true,
    require_admin_approval: false,
    daily_send_quota: 1000,
    per_campaign_quota: 1000,
    cooldown_minutes: 0,
    duplicate_prevention_hours: 24,
  };

  const workflowEmail: AutomationWorkflowConfig = {
    id: "wf-1",
    name: "Test Email WF",
    channel: "email",
    action_type: "create_mock_dispatch",
    delay_amount: 15,
    delay_unit: "minutes"
  };

  const workflowZalo: AutomationWorkflowConfig = {
    id: "wf-2",
    name: "Test Zalo WF",
    channel: "zalo",
    action_type: "create_mock_dispatch",
    delay_amount: 1,
    delay_unit: "days"
  };

  it("should calculate correct virtual execute_at time", () => {
    const virtualNow = new Date("2026-06-30T10:00:00.000Z");
    const result = simulateAutomationScheduler(workflowEmail, [], defaultSafety, virtualNow);
    
    // 15 minutes after 10:00 -> 10:15
    expect(result.virtual_execute_at).toBe("2026-06-30T10:15:00.000Z");
    expect(result.schedule_preview).toContain("Delay: 15 minutes");
  });

  it("should correctly partition eligible and excluded recipients based on consent", () => {
    const recipients: SimulatorRecipientInput[] = [
      {
        id: "c-1",
        email: "c1@test.com",
        preferences: {
          customer_id: "c-1",
          email_opt_in: true,
          zalo_opt_in: false,
          global_opt_out: false
        }
      },
      {
        id: "c-2", // Missing preferences -> should be blocked
        email: "c2@test.com",
        preferences: null
      },
      {
        id: "c-3",
        email: "c3@test.com",
        preferences: {
          customer_id: "c-3",
          email_opt_in: false, // Opted out of email -> should be blocked
          zalo_opt_in: true,
          global_opt_out: false
        }
      }
    ];

    const result = simulateAutomationScheduler(workflowEmail, recipients, defaultSafety);

    expect(result.eligible_count).toBe(1);
    expect(result.excluded_count).toBe(2);
    
    const c1 = result.recipient_preview.find(r => r.customer_id === "c-1")!;
    expect(c1.would_enqueue).toBe(true);
    expect(c1.would_send).toBe(false); // MUST always be false in M41

    const c2 = result.recipient_preview.find(r => r.customer_id === "c-2")!;
    expect(c2.would_enqueue).toBe(false);
    expect(c2.exclusion_reason).toContain("Consent Gate Blocked");

    const c3 = result.recipient_preview.find(r => r.customer_id === "c-3")!;
    expect(c3.would_enqueue).toBe(false);
    expect(c3.exclusion_reason).toContain("Consent Gate Blocked");
  });

  it("should aggregate exclusion reasons correctly", () => {
    const recipients: SimulatorRecipientInput[] = [
      { id: "c-1", preferences: null }, // Missing consent
      { id: "c-2", preferences: null }, // Missing consent
      { 
        id: "c-3", 
        suppressions: [{ is_active: true, channel: "all", normalized_contact_value: "c3@test.com" }],
        email: "c3@test.com",
        preferences: { customer_id: "c-3", email_opt_in: true, zalo_opt_in: true, global_opt_out: false }
      }
    ];

    const result = simulateAutomationScheduler(workflowEmail, recipients, defaultSafety);
    
    expect(result.eligible_count).toBe(0);
    expect(result.excluded_count).toBe(3);
    
    const reasons = Object.keys(result.exclusion_reasons);
    expect(reasons.length).toBe(2);

    const missingPreferenceReason = Object.entries(result.exclusion_reasons).find(([reason]) =>
      reason.includes("Missing marketing preferences record") || reason.includes("Consent Gate Blocked")
    );

    expect(missingPreferenceReason?.[1]).toBe(2);
    expect(result.exclusion_reasons["Customer is currently in the active suppression list."]).toBe(1);
  });
});
