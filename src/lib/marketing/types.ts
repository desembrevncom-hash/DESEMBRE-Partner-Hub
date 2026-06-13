export type MarketingVisibility = "private" | "public_to_org";

export type SegmentOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "contains"
  | "exists"
  | "not_exists"
  | "before"
  | "after"
  | "between";

export type SegmentField =
  // Customer fields
  | "stage"
  | "status"
  | "source"
  | "province"
  | "city"
  | "owner_sale_id"
  | "owner_tele_id"
  | "created_at"
  // Contact readiness
  | "has_valid_phone"
  | "has_zalo_capable_phone"
  | "has_email"
  | "has_facebook_url"
  | "has_facebook_uid"
  | "has_any_contact_channel"
  | "has_data_quality_issue"
  | "phone_possibly_missing_leading_zero"
  | "phone_is_facebook_uid"
  // Remarketing
  | "CALL_READY"
  | "ZALO_READY"
  | "FACEBOOK_READY"
  | "EMAIL_READY"
  | "HAS_FACEBOOK_NO_PHONE"
  | "NEEDS_PHONE"
  | "DATA_CLEANUP_REQUIRED"
  | "UNASSIGNED";

export interface SegmentRule {
  field: SegmentField;
  operator: SegmentOperator;
  value?: any;
}

export interface SegmentRuleGroup {
  type: "AND" | "OR";
  rules: (SegmentRule | SegmentRuleGroup)[];
}

export interface FilterRulesJson {
  group: SegmentRuleGroup;
}

export interface MarketingSegment {
  id: string;
  name: string;
  description: string | null;
  filter_rules_json: FilterRulesJson;
  visibility: MarketingVisibility;
  version: number;
  created_by: string;
  updated_by: string | null;
  archived_at: string | null;
  archived_by: string | null;
  last_preview_count: number | null;
  last_previewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudienceStats {
  total_customers: number;
  matched_customers: number;
  callable_count: number;
  zalo_count: number;
  email_count: number;
  facebook_count: number;
  data_quality_issue_count: number;
  missing_phone_count: number;
  unassigned_count: number;
  skipped_reasons: Record<string, number>;
  sample: any[];
}
