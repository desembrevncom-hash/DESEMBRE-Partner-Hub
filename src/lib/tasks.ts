import { isPast, isToday } from "date-fns";

export type TaskType = 'call' | 'visit' | 'quotation' | 'contract' | 'follow_up' | 'onboarding';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Trả về nhãn hiển thị cho loại công việc
 */
export const getTaskTypeLabel = (type: string): string => {
  const types: Record<string, string> = {
    call: "Gọi điện",
    visit: "Viếng thăm",
    quotation: "Gửi báo giá",
    contract: "Ký hợp đồng",
    follow_up: "Chăm sóc sau bán",
    onboarding: "Hướng dẫn đại lý",
  };
  return types[type] || "Khác";
};

/**
 * Trả về nhãn hiển thị cho trạng thái công việc
 */
export const getTaskStatusLabel = (status: string): string => {
  const statuses: Record<string, string> = {
    pending: "Chưa thực hiện",
    in_progress: "Đang xử lý",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  return statuses[status] || "Chưa rõ";
};

/**
 * Trả về nhãn hiển thị cho mức độ ưu tiên
 */
export const getTaskPriorityLabel = (priority: string): string => {
  const priorities: Record<string, string> = {
    low: "Thấp",
    normal: "Bình thường",
    high: "Cao",
    urgent: "Khẩn cấp",
  };
  return priorities[priority] || "Bình thường";
};

/**
 * Kiểm tra xem công việc có bị quá hạn không
 */
export const isTaskOverdue = (dueAt: string | null | undefined, status: string): boolean => {
  if (!dueAt || status === 'completed' || status === 'cancelled') return false;
  
  const dueDate = new Date(dueAt);
  // Quá hạn nếu là quá khứ và không phải hôm nay (hoặc nếu cần chính xác đến từng phút thì dùng isPast)
  return isPast(dueDate) && !isToday(dueDate);
};
