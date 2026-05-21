// AI Suggestion Engine (Rule-based)
// Deterministic, Fast, Stable. No AI used here.

export type AISuggestionType = "upsell" | "retention" | "follow_up" | "risk";
export type AISuggestionPriority = "low" | "medium" | "high";

export interface RawSuggestion {
  id: string; // unique ID for tracking
  type: AISuggestionType;
  priority: AISuggestionPriority;
  title: string;
  reason: string;
  rule_id: string; // Identifier for the rule triggered (e.g. 'no_reorder_30d')
  suggestedProducts?: number[]; // Array of product_ids
  suggestedAction?: string;
  generatedPrompt?: string; // Filled by AI Rewrite later
}

// Rules

function evaluateNoReorder(orders: any[]): RawSuggestion | null {
  if (!orders || orders.length === 0) return null;
  const latestOrder = orders[0];
  const daysSinceLastOrder = (new Date().getTime() - new Date(latestOrder.created_at).getTime()) / (1000 * 3600 * 24);

  if (daysSinceLastOrder > 30 && daysSinceLastOrder <= 60) {
    return {
      id: crypto.randomUUID(),
      type: "retention",
      priority: "medium",
      title: "Đã 30 ngày chưa mua lại",
      reason: "Khách hàng có đơn hàng cuối cùng cách đây hơn 30 ngày. Cần hỏi thăm tình trạng sử dụng sản phẩm.",
      rule_id: "no_reorder_30d",
      suggestedAction: "Gọi điện hỏi thăm, xin feedback",
    };
  }
  return null;
}

function evaluateInactiveCustomer(activities: any[]): RawSuggestion | null {
  if (!activities || activities.length === 0) {
    return {
      id: crypto.randomUUID(),
      type: "risk",
      priority: "high",
      title: "Khách hàng mới chưa được chăm sóc",
      reason: "Chưa có bất kỳ hoạt động tương tác nào được ghi nhận với khách hàng này.",
      rule_id: "no_activity",
      suggestedAction: "Lên lịch gọi tư vấn và tìm hiểu nhu cầu",
    };
  }

  const latestActivity = activities[0];
  const daysSinceLastActivity = (new Date().getTime() - new Date(latestActivity.created_at).getTime()) / (1000 * 3600 * 24);

  if (daysSinceLastActivity > 60) {
    return {
      id: crypto.randomUUID(),
      type: "risk",
      priority: "high",
      title: "Nguy cơ mất khách (Khách ngủ đông)",
      reason: "Đã hơn 60 ngày không có tương tác nào được ghi nhận.",
      rule_id: "inactive_customer_60d",
      suggestedAction: "Gửi chương trình khuyến mãi re-engagement hoặc nhắn tin hỏi thăm",
    };
  }
  return null;
}

function evaluateHighValueCustomer(orders: any[]): RawSuggestion | null {
  if (!orders || orders.length === 0) return null;
  
  const totalSpend = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  if (totalSpend > 10000000) { // e.g. 10 million VND VIP threshold
    return {
      id: crypto.randomUUID(),
      type: "upsell",
      priority: "high",
      title: "Khách hàng VIP (Chi tiêu cao)",
      reason: "Khách hàng đã chi tiêu mức VIP. Có khả năng cao chốt được các combo/sản phẩm cao cấp mới.",
      rule_id: "high_value_customer",
      suggestedAction: "Giới thiệu bộ sản phẩm cao cấp mới ra mắt",
    };
  }
  return null;
}

function evaluateProductPairing(orders: any[], items: any[]): RawSuggestion | null {
  if (!orders || orders.length === 0 || !items || items.length === 0) return null;

  // Example Logic: Bought Cleanser (product_id 1) but not Toner (product_id 2)
  const boughtProducts = new Set(items.map(i => i.product_id));
  
  if (boughtProducts.has(1) && !boughtProducts.has(2)) {
    return {
      id: crypto.randomUUID(),
      type: "upsell",
      priority: "medium",
      title: "Thiếu sản phẩm bổ trợ (Toner)",
      reason: "Khách đã mua Sữa rửa mặt nhưng chưa mua Nước tẩy trang/Toner đi kèm.",
      rule_id: "bought_x_not_y",
      suggestedProducts: [2],
      suggestedAction: "Tư vấn thêm Nước tẩy trang để tối ưu chu trình làm sạch",
    };
  }
  return null;
}

function evaluatePendingQuote(tasks: any[]): RawSuggestion | null {
  if (!tasks || tasks.length === 0) return null;
  // Look for tasks that indicate a quote was sent but not followed up
  const quoteTask = tasks.find(t => 
    (t.title?.toLowerCase().includes('báo giá') || t.title?.toLowerCase().includes('quote')) && 
    t.status === 'completed'
  );

  if (quoteTask) {
    const daysSinceQuote = (new Date().getTime() - new Date(quoteTask.created_at).getTime()) / (1000 * 3600 * 24);
    if (daysSinceQuote > 3 && daysSinceQuote < 14) {
      return {
        id: crypto.randomUUID(),
        type: "follow_up",
        priority: "medium",
        title: "Theo dõi báo giá",
        reason: "Đã gửi báo giá cách đây vài ngày nhưng chưa chốt.",
        rule_id: "no_activity_after_quote",
        suggestedAction: "Hỏi khách đã xem qua báo giá chưa và có thắc mắc gì không",
      };
    }
  }
  return null;
}

/**
 * Runs the deterministic rule engine and returns the TOP 3 suggestions.
 * Priorities: Risk (1) -> Upsell (1) -> High Priority Other (1)
 */
export function generateSuggestions(params: {
  customer: any;
  orders: any[];
  items: any[];
  activities: any[];
  tasks: any[];
}): RawSuggestion[] {
  const { orders, items, activities, tasks } = params;
  const allSuggestions: RawSuggestion[] = [];

  // Evaluate all rules
  const ruleEvaluators = [
    () => evaluateInactiveCustomer(activities),
    () => evaluateNoReorder(orders),
    () => evaluateHighValueCustomer(orders),
    () => evaluateProductPairing(orders, items),
    () => evaluatePendingQuote(tasks)
  ];

  for (const evaluate of ruleEvaluators) {
    const result = evaluate();
    if (result) allSuggestions.push(result);
  }

  // Pick TOP 3
  const top3: RawSuggestion[] = [];

  // 1. Pick 1 High Priority / Risk
  const riskIndex = allSuggestions.findIndex(s => s.type === "risk" || (s.priority === "high" && s.type !== "upsell"));
  if (riskIndex !== -1) {
    top3.push(allSuggestions[riskIndex]);
    allSuggestions.splice(riskIndex, 1);
  }

  // 2. Pick 1 Upsell
  const upsellIndex = allSuggestions.findIndex(s => s.type === "upsell");
  if (upsellIndex !== -1) {
    top3.push(allSuggestions[upsellIndex]);
    allSuggestions.splice(upsellIndex, 1);
  }

  // 3. Pick 1 Remaining High/Medium
  if (allSuggestions.length > 0 && top3.length < 3) {
    // Sort by priority (high > medium > low)
    const priorityWeight: Record<AISuggestionPriority, number> = { high: 3, medium: 2, low: 1 };
    allSuggestions.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
    top3.push(allSuggestions[0]);
  }

  return top3;
}
