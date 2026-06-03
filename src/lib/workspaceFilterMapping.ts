/**
 * workspaceFilterMapping.ts
 * Centralized mapping for Workspace KPI cards → /customers or /orders routes.
 * All navigation MUST use `risk` param (not `filter`) for /customers.
 * Avoids scattered string literals and prevents reintroducing ?filter= bugs.
 */

export interface WorkspaceRoute {
  path: string;
  search: Record<string, string>;
}

/** Maps KPI card type keys → correct route + search params */
export function workspaceKpiToRoute(type: string): WorkspaceRoute | null {
  const map: Record<string, WorkspaceRoute> = {
    lead: { path: "/customers", search: { risk: "leads_to_call" } },
    followup: { path: "/customers", search: { risk: "today" } },
    checkin: { path: "/customers", search: { risk: "checkin_today" } },
    quotation: { path: "/customers", search: { risk: "quotation_pending" } },
    overdue: { path: "/customers", search: { risk: "overdue" } },
    draft_order: { path: "/orders", search: { filter: "draft" } },
  };
  return map[type] ?? null;
}

/** Maps Smart Alert type keys → correct route + search params */
export function workspaceAlertToRoute(type: string): WorkspaceRoute | null {
  const map: Record<string, WorkspaceRoute> = {
    data_stale: { path: "/customers", search: { risk: "data_stale" } },
    no_social: { path: "/customers", search: { risk: "no_social" } },
    duplicate_phone: { path: "/customers", search: { risk: "duplicate_phone" } },
    overdue: { path: "/customers", search: { risk: "overdue" } },
  };
  return map[type] ?? null;
}

/** Human-readable Vietnamese labels for all risk filter values */
export const customerRiskLabels: Record<string, string> = {
  leads_to_call: "Lead cần gọi",
  today: "Follow-up hôm nay",
  checkin_today: "Cần check-in",
  quotation_pending: "Báo giá chưa chốt",
  overdue: "Sắp thu hồi / quá hạn",
  data_stale: "Khách ngủ đông",
  no_social: "Thiếu MXH",
  duplicate_phone: "Trùng dữ liệu",
  // existing filters
  unassigned: "Lead chưa phân công",
  data_ok: "Dữ liệu OK",
  data_warning: "Cần chú ý",
  data_danger: "Lỗi dữ liệu",
  data_unassigned: "Chưa chia",
  focus: "Focus – HOT/WARM",
  hot: "HOT Leads",
  cold: "Cold Leads",
  vip: "VIP",
  no_interaction: "Chưa tương tác",
  no_primary: "Chưa có kênh chính",
};
