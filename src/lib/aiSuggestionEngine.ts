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
  score?: number; // Phase 6.4 - Computed score for ranking
  purchase_probability?: number; // Base probability (0-100) assigned by rule
}

// Rules

function evaluateNoReorder(orders: any[]): RawSuggestion | null {
  if (!orders || orders.length === 0) return null;
  const latestOrder = orders[0];
  const daysSinceLastOrder =
    (new Date().getTime() - new Date(latestOrder.created_at).getTime()) / (1000 * 3600 * 24);

  if (daysSinceLastOrder > 30 && daysSinceLastOrder <= 60) {
    return {
      id: crypto.randomUUID(),
      type: "retention",
      priority: "medium",
      title: "Đã 30 ngày chưa mua lại",
      reason:
        "Khách hàng có đơn hàng cuối cùng cách đây hơn 30 ngày. Cần hỏi thăm tình trạng sử dụng sản phẩm.",
      rule_id: "no_reorder_30d",
      suggestedAction: "Gọi điện hỏi thăm, xin feedback",
      purchase_probability: 60,
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
      purchase_probability: 40,
    };
  }

  const latestActivity = activities[0];
  const daysSinceLastActivity =
    (new Date().getTime() - new Date(latestActivity.created_at).getTime()) / (1000 * 3600 * 24);

  if (daysSinceLastActivity > 60) {
    return {
      id: crypto.randomUUID(),
      type: "risk",
      priority: "high",
      title: "Nguy cơ mất khách (Khách ngủ đông)",
      reason: "Đã hơn 60 ngày không có tương tác nào được ghi nhận.",
      rule_id: "inactive_customer_60d",
      suggestedAction: "Gửi chương trình khuyến mãi re-engagement hoặc nhắn tin hỏi thăm",
      purchase_probability: 20,
    };
  }
  return null;
}

function evaluateHighValueCustomer(orders: any[]): RawSuggestion | null {
  if (!orders || orders.length === 0) return null;

  const totalSpend = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  if (totalSpend > 10000000) {
    // e.g. 10 million VND VIP threshold
    return {
      id: crypto.randomUUID(),
      type: "upsell",
      priority: "high",
      title: "Khách hàng VIP (Chi tiêu cao)",
      reason:
        "Khách hàng đã chi tiêu mức VIP. Có khả năng cao chốt được các combo/sản phẩm cao cấp mới.",
      rule_id: "high_value_customer",
      suggestedAction: "Giới thiệu bộ sản phẩm cao cấp mới ra mắt",
      purchase_probability: 75,
    };
  }
  return null;
}

function evaluateProductPairing(orders: any[], items: any[]): RawSuggestion | null {
  if (!orders || orders.length === 0 || !items || items.length === 0) return null;

  // Example Logic: Bought Cleanser (product_id 1) but not Toner (product_id 2)
  const boughtProducts = new Set(items.map((i) => i.product_id));

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
      purchase_probability: 85,
    };
  }
  return null;
}

function evaluatePendingQuote(tasks: any[]): RawSuggestion | null {
  if (!tasks || tasks.length === 0) return null;
  // Look for tasks that indicate a quote was sent but not followed up
  const quoteTask = tasks.find(
    (t) =>
      (t.title?.toLowerCase().includes("báo giá") || t.title?.toLowerCase().includes("quote")) &&
      t.status === "completed",
  );

  if (quoteTask) {
    const daysSinceQuote =
      (new Date().getTime() - new Date(quoteTask.created_at).getTime()) / (1000 * 3600 * 24);
    if (daysSinceQuote > 3 && daysSinceQuote < 14) {
      return {
        id: crypto.randomUUID(),
        type: "follow_up",
        priority: "medium",
        title: "Theo dõi báo giá",
        reason: "Đã gửi báo giá cách đây vài ngày nhưng chưa chốt.",
        rule_id: "no_activity_after_quote",
        suggestedAction: "Hỏi khách đã xem qua báo giá chưa và có thắc mắc gì không",
        purchase_probability: 50,
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
    () => evaluatePendingQuote(tasks),
  ];

  for (const evaluate of ruleEvaluators) {
    const result = evaluate();
    if (result) allSuggestions.push(result);
  }

  // --- PHASE 6.4: SCORING ENGINE ---

  // 1. Calculate normalized LTV score (0-100)
  // Assume 50,000,000 VND is the top benchmark for 100 score
  const totalSpend = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const ltv_score = Math.min((totalSpend / 50000000) * 100, 100);

  // 2. Calculate normalized Days Inactive score (0-100)
  // 0 days = 0 score, 90+ days = 100 score (high risk/need to act)
  let days_inactive = 0;
  if (activities && activities.length > 0) {
    days_inactive =
      (new Date().getTime() - new Date(activities[0].created_at).getTime()) / (1000 * 3600 * 24);
  } else {
    days_inactive = 90; // Max inactive if no activities
  }
  const inactive_score = Math.min((days_inactive / 90) * 100, 100);

  // 3. Apply formula to all suggestions
  allSuggestions.forEach((suggestion) => {
    const prob = suggestion.purchase_probability || 50;
    // Formula: score = (customer_ltv * 0.3) + (days_inactive * 0.4) + (purchase_probability * 0.3)
    suggestion.score = Math.round(ltv_score * 0.3 + inactive_score * 0.4 + prob * 0.3);
  });

  // 4. Sort by score descending
  allSuggestions.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Pick TOP 3
  return allSuggestions.slice(0, 3);
}
