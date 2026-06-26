export interface MockWorkerRequest {
  send_batch_id: string;
  limit: number;
  force_result?: 'delivered' | 'failed' | null;
}

export interface MockWorkerSummary {
  total_claimed: number;
  successfully_finalized: number;
  failed_to_finalize: number;
}

export interface MockWorkerRowDetail {
  dispatch_id: string | null;
  simulated_status: string | null;
  finalize_result: 'success' | 'error';
  error: string | null;
}

export interface MockWorkerResponse {
  success: boolean;
  message: string;
  execution_id?: string;
  claimed_count?: number; // From claim step
  summary?: MockWorkerSummary;
  details?: MockWorkerRowDetail[];
  error?: string;
}

export interface MockDispatchAttempt {
  id: string;
  send_batch_id: string;
  queue_id: string;
  dispatch_id: string;
  attempt_type: string;
  payload_snapshot_json: any;
  result_json: any;
  created_at: string;
  idempotency_key: string;
  created_by_user_id?: string;
}
