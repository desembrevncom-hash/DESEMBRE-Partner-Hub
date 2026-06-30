import { evaluateMarketingSafety, MarketingSafetySettings, MarketingSafetyContext } from "./safetyRules";
import { evaluateCustomerConsent, CustomerMarketingPreferences } from "./evaluateCustomerConsent";

export interface SimulatorRecipientInput {
  id: string;
  email?: string;
  phone?: string;
  preferences?: CustomerMarketingPreferences | null;
  suppressions?: any[];
}

export interface AutomationWorkflowConfig {
  id: string;
  name: string;
  action_type: string; // "create_mock_dispatch" | "add_to_mock_queue" | "log_only" | ...
  channel: "email" | "zalo";
  delay_amount: number;
  delay_unit: "minutes" | "hours" | "days";
}

export interface SimulatorRecipientOutput {
  customer_id: string;
  email?: string;
  phone?: string;
  would_enqueue: boolean;
  would_send: boolean;
  consent_gate_result: any;
  safety_gate_result: any;
  exclusion_reason?: string;
}

export interface SchedulerSimulatorResult {
  schedule_preview: string;
  virtual_execute_at: string;
  eligible_count: number;
  excluded_count: number;
  exclusion_reasons: Record<string, number>;
  recipient_preview: SimulatorRecipientOutput[];
}

export function simulateAutomationScheduler(
  workflow: AutomationWorkflowConfig,
  recipients: SimulatorRecipientInput[],
  safetySettings: MarketingSafetySettings,
  virtualNow: Date = new Date()
): SchedulerSimulatorResult {
  
  // Calculate Virtual Execute At
  const delayMs = calculateDelayMs(workflow.delay_amount, workflow.delay_unit);
  const executeAt = new Date(virtualNow.getTime() + delayMs);
  
  const result: SchedulerSimulatorResult = {
    schedule_preview: `Will execute at ${executeAt.toISOString()} (Delay: ${workflow.delay_amount} ${workflow.delay_unit})`,
    virtual_execute_at: executeAt.toISOString(),
    eligible_count: 0,
    excluded_count: 0,
    exclusion_reasons: {},
    recipient_preview: []
  };

  for (const rec of recipients) {
    const context: MarketingSafetyContext = {
      channel: workflow.channel,
      approved: true, // Simulation assumes admin approved the workflow
      customer: {
        id: rec.id,
        email: rec.email,
        phone: rec.phone
      },
      suppressions: rec.suppressions || [],
      is_sandbox_internal: false,
      customer_preferences: rec.preferences
    };

    const safetyRes = evaluateMarketingSafety(safetySettings, context);
    
    // In M41, we do not actually send. 
    // We only simulate if it WOULD be enqueued based on safety.
    const wouldEnqueue = safetyRes.allowed;
    let exclusionReason = "";

    if (wouldEnqueue) {
      result.eligible_count++;
    } else {
      result.excluded_count++;
      // Combine reasons
      exclusionReason = safetyRes.reasons.join(" | ");
      if (result.exclusion_reasons[exclusionReason]) {
        result.exclusion_reasons[exclusionReason]++;
      } else {
        result.exclusion_reasons[exclusionReason] = 1;
      }
    }

    result.recipient_preview.push({
      customer_id: rec.id,
      email: rec.email,
      phone: rec.phone,
      would_enqueue: wouldEnqueue,
      would_send: false, // M41 rule: always false for safety
      consent_gate_result: safetyRes.consent,
      safety_gate_result: safetyRes,
      exclusion_reason: exclusionReason || undefined
    });
  }

  return result;
}

function calculateDelayMs(amount: number, unit: "minutes" | "hours" | "days"): number {
  switch (unit) {
    case "minutes": return amount * 60 * 1000;
    case "hours": return amount * 60 * 60 * 1000;
    case "days": return amount * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}
