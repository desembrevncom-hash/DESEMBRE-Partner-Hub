export type CustomerQueueStatus =
  | "no_follow_up"
  | "quoted_not_closed"
  | "inactive_14d"
  | "purchased_old"
  | "new_lead_no_touch";

export const getSuggestedTemplateCategory = (status: CustomerQueueStatus): string => {
  switch (status) {
    case "no_follow_up":
      return "Chăm sóc lại";
    case "quoted_not_closed":
      return "Báo giá";
    case "inactive_14d":
      return "Chăm sóc lại"; // Map to closest matching category in SaleTemplatePicker
    case "purchased_old":
      return "Upsell";
    case "new_lead_no_touch":
      return "CSKH"; // Hoặc có thể là 'Chào hỏi ban đầu' nếu mở rộng
    default:
      return "Tất cả";
  }
};

export const getQueueStatusLabel = (status: CustomerQueueStatus): string => {
  switch (status) {
    case "no_follow_up":
      return "Thiếu follow-up";
    case "quoted_not_closed":
      return "Đã báo giá chưa chốt";
    case "inactive_14d":
      return "Chưa tương tác > 14 ngày";
    case "purchased_old":
      return "Doanh thu cũ, chưa mua lại";
    case "new_lead_no_touch":
      return "Lead mới, chưa liên hệ";
    default:
      return "Khác";
  }
};
