import { MockDispatchRow } from "../__fixtures__/mockDispatchRows";
import { maskContactValue } from "./piiMasking";
import { generateIdempotencyKey } from "./idempotency";

export interface MockExecutionResult {
  dispatchId: string;
  idempotencyKey: string;
  maskedContact: string;
  success: boolean;
  error?: string;
  simulatedTimeMs: number;
}

export interface MockExecutionSummary {
  processed: number;
  success: number;
  failed: number;
  results: MockExecutionResult[];
}

export function simulateMockExecution(
  rows: MockDispatchRow[],
  gatewayEnabled: boolean
): MockExecutionSummary {
  if (!gatewayEnabled) {
    throw new Error("GATEWAY_ABORT: Execution aborted because gateway is disabled.");
  }

  const results: MockExecutionResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    if (row.status !== "ready") continue;

    const idemKey = generateIdempotencyKey(
      row.idempotency_key,
      row.id,
      row.channel,
      row.provider_account_id
    );

    const maskedContact = maskContactValue(row.contact_value);
    const simulationDirective = row.payload_snapshot_json?.simulate || "success";

    let success = false;
    let error: string | undefined = undefined;
    let simulatedTimeMs = 100;

    if (simulationDirective === "success") {
      success = true;
      simulatedTimeMs = 150;
    } else if (simulationDirective === "failure") {
      success = false;
      error = "MOCK_PROVIDER_ERROR: Invalid template mapping";
      simulatedTimeMs = 50;
    } else if (simulationDirective === "timeout") {
      success = false;
      error = "MOCK_PROVIDER_TIMEOUT: Request took too long";
      simulatedTimeMs = 5000;
    }

    if (success) {
      successCount++;
    } else {
      failedCount++;
    }

    results.push({
      dispatchId: row.id,
      idempotencyKey: idemKey,
      maskedContact,
      success,
      error,
      simulatedTimeMs
    });
  }

  return {
    processed: results.length,
    success: successCount,
    failed: failedCount,
    results
  };
}
