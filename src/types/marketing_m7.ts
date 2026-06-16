export type M7SendBatchStatus = 'created' | 'enqueued' | 'processing' | 'completed' | 'cancelled';

export interface M7SendBatch {
  id: string;
  campaign_id: string;
  provider_account_id: string;
  marketing_template_id: string;
  provider_template_mapping_id: string;
  channel: string;
  status: M7SendBatchStatus;
  total_recipients: number;
  total_queued: number;
  total_skipped: number;
  total_processing: number;
  total_simulated_success: number;
  skip_reasons_summary: Record<string, number>;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface M7PreviewResult {
  total_valid: number;
  total_skipped: number;
  skip_reasons_summary: Record<string, number>;
}
