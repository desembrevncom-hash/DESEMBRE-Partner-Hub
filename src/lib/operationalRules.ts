import { differenceInDays, differenceInHours } from "date-fns";
import { getCustomerConversationState } from "./customerConversationState";

export function getPriorityScore(customer: any): number {
  let score = 0;
  const state = getCustomerConversationState(customer);
  const totalValue = customer.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;

  // Urgency
  if (state.urgency === "overdue") score += 50;
  if (state.urgency === "today") score += 30;

  // Temperature
  if (state.temperature === "HOT") score += 15;
  if (state.temperature === "WARM") score += 5;

  // Value
  if (totalValue >= 50000000) score += 10; // VIP

  // Stage context
  const stage = customer.lifecycle_stage || "";
  if (stage.includes("quote") || stage.includes("proposal") || stage.includes("negotiation")) {
    score += 20; // Quote pending
  }

  return score;
}

export function getSuggestedNextAction(customer: any): string | null {
  const state = getCustomerConversationState(customer);
  const stage = customer.lifecycle_stage || "";
  const isQuotePending =
    stage.includes("quote") || stage.includes("proposal") || stage.includes("negotiation");
  const hasSocial =
    customer.channel_summary?.has_facebook ||
    customer.channel_summary?.has_zalo ||
    customer.channel_summary?.has_tiktok;

  if (state.urgency === "overdue") return "Gọi lại ngay (quá hạn)";
  if (state.urgency === "today") return "Gọi lại đúng hẹn";

  if (state.temperature === "HOT" && !state.nextFollowUpTime) {
    if (isQuotePending) return "Gọi chốt deal";
    return "Gọi chốt nóng";
  }

  if (isQuotePending && state.temperature !== "HOT" && state.urgency === "inactive") {
    return "Hỏi thăm tình trạng báo giá";
  }

  const staleSignals = getStaleSignals(customer);

  if (staleSignals.some((s) => s.signal === "no_touchpoint")) {
    return "Bắt đầu tương tác";
  }

  if (staleSignals.some((s) => s.signal === "lead_dead") && !hasSocial) {
    return "Tìm thêm kênh Zalo/FB";
  }

  if (staleSignals.some((s) => s.signal === "forgotten")) {
    return "Khơi gợi lại nhu cầu";
  }

  if (stage === "lead_new" || stage === "new") {
    return "Tiếp cận lần đầu";
  }

  // Mặc định nếu quá lâu không gọi
  if (!state.nextFollowUpTime && state.temperature === "COLD") {
    return "Gửi tin nhắn hâm nóng";
  }

  return null;
}

export type StaleSignal =
  | "lead_dead"
  | "forgotten"
  | "stage_stuck"
  | "quote_ignored"
  | "no_touchpoint";

export function getStaleSignals(customer: any): { signal: StaleSignal; message: string }[] {
  const signals: { signal: StaleSignal; message: string }[] = [];
  const state = getCustomerConversationState(customer);
  const now = new Date();

  const lastActivityDate = state.lastInteractionTime
    ? new Date(state.lastInteractionTime)
    : new Date(customer.created_at);
  const daysSinceActivity = differenceInDays(now, lastActivityDate);
  const stage = customer.lifecycle_stage || "";

  // No touchpoint
  if (!state.lastInteractionTime) {
    signals.push({ signal: "no_touchpoint", message: `Chưa từng tương tác` });
  }

  // Lead dead
  if ((stage === "lead_new" || stage === "new" || stage === "lead") && daysSinceActivity > 14) {
    signals.push({ signal: "lead_dead", message: `Lead mới lọt lưới ${daysSinceActivity} ngày` });
  }

  // Quote ignored
  if ((stage.includes("quote") || stage.includes("proposal")) && daysSinceActivity > 3) {
    signals.push({
      signal: "quote_ignored",
      message: `Gửi báo giá ${daysSinceActivity} ngày chưa liên hệ lại`,
    });
  }

  // Forgotten
  const isClosed = stage === "lost" || stage === "won" || stage === "customer";
  if (!isClosed && daysSinceActivity > 30) {
    signals.push({ signal: "forgotten", message: `Lãng quên ${daysSinceActivity} ngày` });
  }

  return signals;
}
