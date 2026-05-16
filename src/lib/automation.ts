
import { supabase } from "@/integrations/supabase/client";
import { addHours, addDays, startOfHour } from "date-fns";

/**
 * CRM AUTOMATION CORE - DESEMBRE PARTNER HUB
 * Tập hợp các helper tạo Task/Notification tự động dựa trên sự kiện.
 */

// 1. Tự động hóa khi Lead được phân phối cho Sale
export const createLeadAssignedAutomation = async (
  leadId: string, 
  leadName: string, 
  saleId: string, 
  assignedByName: string
) => {
  try {
    // A. Tạo Task gọi điện (Deadline: 4 giờ kể từ lúc gán)
    const dueDate = addHours(new Date(), 4);
    
    const { error: taskError } = await supabase.from("customer_tasks").insert([{
      lead_id: leadId,
      assigned_to: saleId,
      title: `📞 Liên hệ lần đầu: ${leadName}`,
      description: `Lead mới được gán bởi ${assignedByName}. Cần gọi điện thăm dò nhu cầu trong vòng 4h.`,
      task_type: "call",
      priority: "high",
      due_at: dueDate.toISOString(),
      status: "pending"
    }]);

    if (taskError) throw taskError;

    // B. Tạo Notification cho Sale
    const { error: notifyError } = await supabase.from("notifications").insert([{
      recipient_user_id: saleId,
      title: "🎯 Lead mới được phân bổ",
      message: `Bạn vừa được ${assignedByName} gán lead mới: ${leadName}. Hãy kiểm tra và liên hệ ngay!`,
      type: "lead_assigned",
      action_url: `/customers` // Link tới trang danh sách hoặc chi tiết lead
    }]);

    if (notifyError) throw notifyError;

    return { success: true };
  } catch (error) {
    console.error("Automation Error [LeadAssigned]:", error);
    return { success: false, error };
  }
};

// 2. Tự động hóa Follow-up báo giá (Sau 3 ngày)
export const createQuoteFollowUpAutomation = async (
  customerId: string,
  customerName: string,
  saleId: string,
  quoteId: string
) => {
  try {
    const dueDate = addDays(new Date(), 3);

    const { error } = await supabase.from("customer_tasks").insert([{
      customer_id: customerId,
      assigned_to: saleId,
      title: `📝 Follow-up báo giá: ${customerName}`,
      description: `Kiểm tra phản hồi của khách hàng về báo giá #${quoteId.slice(0, 8)}. Thúc đẩy chốt đơn.`,
      task_type: "follow_up",
      priority: "medium",
      due_at: dueDate.toISOString(),
      status: "pending"
    }]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Automation Error [QuoteFollowUp]:", error);
    return { success: false, error };
  }
};

// 3. Tự động hóa Check-in sau mua (Sau 7 ngày)
export const createPostPurchaseCheckinAutomation = async (
  customerId: string,
  customerName: string,
  saleId: string,
  orderId: string
) => {
  try {
    const dueDate = addDays(new Date(), 7);

    const { error } = await supabase.from("customer_tasks").insert([{
      customer_id: customerId,
      assigned_to: saleId,
      title: `🏥 Check-in sau mua: ${customerName}`,
      description: `Khách đã nhận đơn #${orderId.slice(0, 8)} được 7 ngày. Gọi điện hỏi thăm hiệu quả sử dụng phác đồ và hỗ trợ kỹ thuật.`,
      task_type: "visit", // Hoặc "check_in" nếu có type riêng
      priority: "medium",
      due_at: dueDate.toISOString(),
      status: "pending"
    }]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Automation Error [PostPurchase]:", error);
    return { success: false, error };
  }
};

// 4. Cảnh báo Task quá hạn
export const createOverdueTaskNotification = async (
  userId: string,
  taskTitle: string,
  taskId: string
) => {
  try {
    const { error } = await supabase.from("notifications").insert([{
      recipient_user_id: userId,
      title: "⚠️ Cảnh báo: Task quá hạn",
      message: `Công việc "${taskTitle}" đã quá hạn xử lý. Vui lòng cập nhật trạng thái ngay.`,
      type: "task_overdue",
      action_url: `/workspace`
    }]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Automation Error [OverdueTask]:", error);
    return { success: false, error };
  }
};
