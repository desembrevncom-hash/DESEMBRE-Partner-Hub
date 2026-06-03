import { getCustomerConversationState } from "./customerConversationState";

export interface CustomerVisualConfig {
  borderColor: string;
  bgColor: string;
  textColor: string;
  badgeText: string;
  iconColor: string;
  animation?: string;
}

export function getCustomerVisualState(customer: any): CustomerVisualConfig {
  const state = getCustomerConversationState(customer);

  if (state.urgency === "overdue") {
    return {
      borderColor: "border-l-4 border-l-red-500 shadow-[rgba(239,68,68,0.1)_0px_0px_15px_0px]",
      bgColor: "bg-red-50",
      textColor: "text-red-700",
      badgeText: "Quá hạn",
      iconColor: "text-red-500",
    };
  }

  if (state.urgency === "today") {
    return {
      borderColor: "border-l-4 border-l-orange-400",
      bgColor: "bg-orange-50",
      textColor: "text-orange-700",
      badgeText: "Hôm nay",
      iconColor: "text-orange-500",
    };
  }

  if (state.temperature === "HOT") {
    return {
      borderColor: "border-l-4 border-l-green-400",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      badgeText: "Nóng",
      iconColor: "text-green-500",
    };
  }

  if (state.temperature === "COLD" || state.urgency === "inactive") {
    return {
      borderColor: "border-l-4 border-l-slate-300 opacity-80 grayscale-[20%]",
      bgColor: "bg-slate-100",
      textColor: "text-slate-500",
      badgeText: "Lạnh",
      iconColor: "text-slate-400",
    };
  }

  // Default WARM / STALE or healthy
  return {
    borderColor: "border-l-4 border-l-slate-200",
    bgColor: "bg-white",
    textColor: "text-slate-600",
    badgeText: "",
    iconColor: "text-slate-400",
  };
}
