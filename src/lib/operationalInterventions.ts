import { getCustomerConversationState } from "./customerConversationState";
import { differenceInDays } from "date-fns";

export type InterventionSeverity = "critical" | "warning" | "monitor";

export interface OperationalIntervention {
  id: string;
  type:
    | "OVERLOADED_STAFF"
    | "STAGE_BOTTLENECK"
    | "SILENT_VIP"
    | "STALE_QUOTE"
    | "DEAD_LEADS_ACCUMULATION";
  severity: InterventionSeverity;
  title: string;
  reason: string;
  suggestedAction: string;
  targetId?: string; // staff ID, stage name, or customer ID
  metadata?: any;
}

export function getInterventions(
  customers: any[],
  staffMap: Record<string, any>,
): OperationalIntervention[] {
  const interventions: OperationalIntervention[] = [];
  const now = new Date();

  // 1. Calculate Staff Load
  const staffStats: Record<string, { total: number; overdue: number; hot: number }> = {};

  // 2. Calculate Stage Metrics
  const stageStats: Record<string, { count: number; totalDays: number; overdue: number }> = {};

  let deadLeadsCount = 0;

  customers.forEach((c) => {
    const state = getCustomerConversationState(c);
    const stage = c.lifecycle_stage || "new";
    const isClosed = stage === "won" || stage === "lost" || stage === "customer";
    const isOverdue = state.urgency === "overdue";

    // Check VIP Silent
    const totalValue = c.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
    const isVIP = totalValue > 50000000;
    if (isVIP && !isClosed) {
      const daysSinceActivity = state.lastInteractionTime
        ? differenceInDays(now, new Date(state.lastInteractionTime))
        : differenceInDays(now, new Date(c.created_at));
      if (daysSinceActivity > 14) {
        interventions.push({
          id: `vip-silent-${c.id}`,
          type: "SILENT_VIP",
          severity: "critical",
          title: `VIP ngủ đông: ${c.name}`,
          reason: `Khách hàng mang lại doanh thu cao nhưng ${daysSinceActivity} ngày chưa tương tác.`,
          suggestedAction: "Gọi điện hỏi thăm ngay lập tức",
          targetId: c.id,
        });
      }
    }

    // Check Stale Quote
    const isQuotePending =
      stage.includes("quote") || stage.includes("proposal") || stage.includes("negotiation");
    if (isQuotePending && !isClosed) {
      const daysSinceActivity = state.lastInteractionTime
        ? differenceInDays(now, new Date(state.lastInteractionTime))
        : differenceInDays(now, new Date(c.created_at));
      if (daysSinceActivity > 5) {
        interventions.push({
          id: `stale-quote-${c.id}`,
          type: "STALE_QUOTE",
          severity: daysSinceActivity > 7 ? "critical" : "warning",
          title: `Báo giá có nguy cơ rớt: ${c.name}`,
          reason: `Báo giá treo ${daysSinceActivity} ngày không follow-up.`,
          suggestedAction: "Gọi chốt deal hoặc thu hồi",
          targetId: c.id,
        });
      }
    }

    if (!isClosed) {
      // Staff accumulation
      const ownerId = c.owner_sale_id || c.owner_tele_id;
      if (ownerId) {
        if (!staffStats[ownerId]) staffStats[ownerId] = { total: 0, overdue: 0, hot: 0 };
        staffStats[ownerId].total++;
        if (isOverdue) staffStats[ownerId].overdue++;
        if (state.temperature === "HOT") staffStats[ownerId].hot++;
      }

      // Stage accumulation
      if (!stageStats[stage]) stageStats[stage] = { count: 0, totalDays: 0, overdue: 0 };
      stageStats[stage].count++;
      if (isOverdue) stageStats[stage].overdue++;
      const daysInStage = differenceInDays(now, new Date(c.created_at));
      stageStats[stage].totalDays += daysInStage;

      // Dead leads accumulation
      const daysSinceActivity = state.lastInteractionTime
        ? differenceInDays(now, new Date(state.lastInteractionTime))
        : differenceInDays(now, new Date(c.created_at));
      if (daysSinceActivity > 30) {
        deadLeadsCount++;
      }
    }
  });

  // Evaluate Staff Overload
  Object.entries(staffStats).forEach(([staffId, stats]) => {
    if (stats.overdue >= 10) {
      const staffName = staffMap[staffId]?.full_name || "Nhân viên";
      interventions.push({
        id: `overload-${staffId}`,
        type: "OVERLOADED_STAFF",
        severity: "critical",
        title: `${staffName} đang quá tải`,
        reason: `Đang giữ ${stats.overdue} leads quá hạn SLA.`,
        suggestedAction: `Chuyển bớt ${Math.floor(stats.overdue / 2)} leads sang người khác`,
        targetId: staffId,
        metadata: { ...stats },
      });
    } else if (stats.overdue >= 5) {
      const staffName = staffMap[staffId]?.full_name || "Nhân viên";
      interventions.push({
        id: `busy-${staffId}`,
        type: "OVERLOADED_STAFF",
        severity: "warning",
        title: `${staffName} đang dồn việc`,
        reason: `Có ${stats.overdue} leads chưa kịp follow-up.`,
        suggestedAction: `Nhắc nhở giải quyết queue`,
        targetId: staffId,
        metadata: { ...stats },
      });
    }
  });

  // Evaluate Stage Bottlenecks
  Object.entries(stageStats).forEach(([stage, stats]) => {
    if (stats.count >= 5) {
      const overdueRatio = stats.overdue / stats.count;
      const avgDays = Math.round(stats.totalDays / stats.count);

      if (overdueRatio > 0.5 || avgDays > 14) {
        interventions.push({
          id: `bottleneck-${stage}`,
          type: "STAGE_BOTTLENECK",
          severity: overdueRatio > 0.7 ? "critical" : "warning",
          title: `Tắc nghẽn tại ${stage.replace(/_/g, " ").toUpperCase()}`,
          reason: `Tỷ lệ quá hạn ${Math.round(overdueRatio * 100)}%, kẹt trung bình ${avgDays} ngày.`,
          suggestedAction: "Điều tra nút thắt quy trình",
          targetId: stage,
          metadata: { ...stats },
        });
      }
    }
  });

  // Evaluate Dead Leads Accumulation
  if (deadLeadsCount > 20) {
    interventions.push({
      id: `dead-leads-mass`,
      type: "DEAD_LEADS_ACCUMULATION",
      severity: "warning",
      title: "Tích tụ Lead chết diện rộng",
      reason: `Hệ thống đang có ${deadLeadsCount} leads bị đóng băng > 30 ngày.`,
      suggestedAction: "Tạo chiến dịch Re-marketing",
    });
  }

  // Sort by severity
  return interventions.sort((a, b) => {
    const sevMap = { critical: 3, warning: 2, monitor: 1 };
    return sevMap[b.severity] - sevMap[a.severity];
  });
}
