export interface SalesReportInputs {
  id?: string;
  sale_user_id: string;
  report_type: "weekly" | "monthly";
  period_start: string;
  period_end: string;
  variable_cost: number;
  expected_orders_next_period: number;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface SalesPerformanceMetrics {
  total_revenue: number;
  order_count: number;
  customers_who_ordered: number;
  new_customers: number;
  direct_visits: number;
  customers_followed: number;
  active_90_day_customers: number;
  live_zoom_sessions: number;
  opportunities_expected_revenue: number;
  manual_inputs?: SalesReportInputs | null;
}

export interface OpportunityCustomer {
  id: string;
  name: string;
  contact_name?: string;
  facility_name?: string;
  city?: string;
  district?: string;
  source?: string;
  lifecycle_stage: string;
  created_at: string;
  last_reassigned_at?: string;
  last_activity_at?: string;
  last_contacted_at?: string;
  delete_reason?: string;
  reclaim_reason?: string;
  opportunity_expected_revenue: number;
  opportunity_expected_close_date: string | null;
  opportunity_potential_score: number | null;
}
