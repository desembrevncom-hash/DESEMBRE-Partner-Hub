export interface WorkspaceCounters {
  lead_to_call_count: number;
  follow_up_today_count: number;
  check_in_today_count: number;
  quotation_pending_count: number;
  draft_order_count: number;
  overdue_count: number;
}

export interface WorkspacePriorityItem {
  id: string;
  type: "call_lead" | "follow_up" | "check_in" | "quotation_pending" | "draft_order" | "overdue_task" | "upcoming_event";
  title: string;
  subtitle: string;
  customer_id?: string | null;
  customer_name?: string | null;
  due_at?: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  priority_score: number;
  reason: string;
  action_label: string;
  action_type: "open_customer" | "call" | "open_order" | "open_calendar" | "create_note";
  deep_link: string;
}

export interface WorkspaceTimelineEvent {
  id: string;
  title: string;
  event_type: string;
  starts_at: string;
  ends_at?: string | null;
  customer_id?: string | null;
  visibility: string;
}

export interface WorkspaceSmartAlerts {
  stale_customers_count?: number;
  customers_missing_social_count?: number;
  duplicate_channel_risk_count?: number;
  overdue_followups_count?: number;
}

export interface WorkspaceTeamRisk {
  id: string;
  message: string;
  risk_level: "high" | "medium" | "low";
  type: string;
}

export interface WorkspaceExecutionData {
  counters: WorkspaceCounters;
  today_priorities: WorkspacePriorityItem[];
  upcoming_timeline: WorkspaceTimelineEvent[];
  smart_alerts: WorkspaceSmartAlerts;
  team_risks: WorkspaceTeamRisk[];
}
