export interface ProviderAccount {
  id: string;
  provider_type: 'zalo_zns' | 'sendgrid' | 'sms' | 'smtp' | 'other';
  account_name: string;
  external_provider_id?: string;
  readiness_status: 'not_configured' | 'pending_manual_verification' | 'ready' | 'disabled';
  secret_status: 'not_required_yet' | 'missing' | 'configured_externally' | 'invalid_reference';
  secret_reference?: string;
  configured_externally: boolean;
  manual_verification_notes?: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface ProviderTemplateMapping {
  id: string;
  marketing_template_id: string;
  provider_account_id: string;
  provider_template_id: string;
  param_mapping_json: Record<string, string>;
  mapping_status: 'draft' | 'active' | 'archived';
  readiness_status: 'not_configured' | 'pending_manual_verification' | 'ready' | 'disabled';
  last_verified_at?: string;
  verification_notes?: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface ProviderReadinessLog {
  id: string;
  entity_type: 'provider_account' | 'template_mapping';
  entity_id: string;
  action: 'created' | 'updated' | 'archived' | 'readiness_changed' | 'mapping_upserted';
  actor_id: string;
  changes_json: Record<string, any>;
  created_at: string;
}
