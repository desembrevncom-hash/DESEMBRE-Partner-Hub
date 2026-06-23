export interface MockBatch {
  id: string;
  channel: string;
  status: string;
  total_recipients: number;
  total_queued: number;
  total_skipped: number;
  total_simulated_success: number;
  total_simulated_failed: number;
  created_at: string;
}

export interface MockDispatch {
  id: string;
  send_batch_id: string;
  send_queue_id: string;
  channel: string;
  status: string;
  idempotency_key: string;
  mock_execution_id: string | null;
  mock_claimed_at: string | null;
  mock_finalized_at: string | null;
}

export interface MockAttemptLog {
  dispatch_id: string;
  execution_id: string | null;
  event_type: string;
  created_at: string;
  event_json_safe: Record<string, any>;
}
