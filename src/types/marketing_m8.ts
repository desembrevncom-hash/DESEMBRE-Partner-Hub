export type ConsentChannel = 'email' | 'zalo_zns';
export type ConsentStatus = 'opt_in' | 'opt_out' | 'pending';
export type ConsentSource = 'manual_admin' | 'csv_import';

export interface ConsentHistoryRecord {
  id: string;
  customer_id: string;
  channel: ConsentChannel;
  consent_status: ConsentStatus;
  source: string;
  proof_type: string | null;
  proof_reference: string | null;
  proof_note: string | null;
  effective_at: string;
  created_at: string;
  created_by: string;
}

export interface ConsentSummary {
  customer_id: string;
  channel: ConsentChannel;
  consent_status: ConsentStatus;
  effective_at: string;
}

export interface UpdateConsentPayload {
  p_customer_id: string;
  p_channel: ConsentChannel;
  p_status: ConsentStatus;
  p_source: ConsentSource;
  p_proof_type: string | null;
  p_proof_reference: string | null;
  p_proof_note: string | null;
  p_effective_at: string;
  p_idempotency_key: string;
}

export interface BulkImportRow {
  customer_id: string;
  channel: ConsentChannel;
  consent_status: ConsentStatus;
  proof_type: string | null;
  proof_reference: string | null;
  proof_note: string | null;
  effective_at: string;
  idempotency_key?: string | null;
}

export interface BulkImportPayload {
  p_rows: BulkImportRow[];
  p_source: ConsentSource;
  p_dry_run: boolean;
  p_import_batch_id: string | null;
  p_idempotency_key: string;
}
