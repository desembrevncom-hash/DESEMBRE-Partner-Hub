import { getCustomerDataHealth } from "@/lib/customers/dataHealth";
import { getCustomerConversationState } from "@/lib/customerConversationState";
import { differenceInDays } from "date-fns";

export interface NormalizedBadge {
  id: string;
  label: string;
  type: "danger" | "warning" | "priority" | "ok" | "vip";
  priority: number; // lower is more important
  tooltip?: string;
}

export function getCustomerCardBadges(customer: any): NormalizedBadge[] {
  const badges: NormalizedBadge[] = [];
  if (!customer) return badges;

  const health = getCustomerDataHealth(customer);
  const convState = getCustomerConversationState(customer);
  const totalValue = customer.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
  const isVip = totalValue >= 50000000;

  // 1. Contact warnings
  const hasPhone = !!customer.phone;
  const hasEmail = !!customer.email || !!customer.channel_summary?.has_email;

  if (!hasPhone && !hasEmail) {
    badges.push({
      id: "no_contact",
      label: "Thiếu liên hệ",
      type: "danger",
      priority: 1,
      tooltip: "Thiếu cả SĐT và Email",
    });
  } else if (!hasPhone) {
    badges.push({
      id: "no_phone",
      label: "Thiếu SĐT",
      type: "warning",
      priority: 2,
      tooltip: "Thiếu Số điện thoại",
    });
  } else if (!hasEmail) {
    badges.push({
      id: "no_email",
      label: "Thiếu Email",
      type: "warning",
      priority: 3,
      tooltip: "Thiếu Email",
    });
  }

  // 2. Priority / Temperature
  if (convState.temperature === "HOT") {
    badges.push({ id: "temp_hot", label: "🔥 Hot", type: "priority", priority: 4 });
  } else if (convState.temperature === "WARM") {
    badges.push({ id: "temp_warm", label: "⭐ Warm", type: "priority", priority: 4 });
  } else if (convState.temperature === "COLD") {
    badges.push({ id: "temp_cold", label: "❄️ Cold", type: "priority", priority: 4 });
  }

  // 3. Overdue follow-up
  const lastContact = customer.last_contacted_at || customer.last_activity_at;
  if (lastContact) {
    const daysSinceContact = differenceInDays(new Date(), new Date(lastContact));
    if (daysSinceContact > 7) {
      badges.push({
        id: "overdue",
        label: `Quên ${daysSinceContact} ngày`,
        type: "warning",
        priority: 5,
      });
    }
  } else {
    badges.push({ id: "no_interaction", label: "Chưa tương tác", type: "warning", priority: 5 });
  }

  // 4. VIP
  if (isVip) {
    badges.push({ id: "vip", label: "👑 VIP", type: "vip", priority: 6 });
  }

  // 5. Other Data Health issues
  if (health.severity !== "ok") {
    const hasOtherReasons = health.reasons.filter(
      (r) => !r.includes("Thiếu cả SĐT") && !r.includes("Thiếu SĐT") && !r.includes("Thiếu Email"),
    );
    if (hasOtherReasons.length > 0) {
      badges.push({
        id: "data_health",
        label: "Dữ liệu chưa chuẩn",
        type: "warning",
        priority: 7,
        tooltip: hasOtherReasons.join(", "),
      });
    }
  }

  // Sort by priority
  badges.sort((a, b) => a.priority - b.priority);

  return badges;
}
