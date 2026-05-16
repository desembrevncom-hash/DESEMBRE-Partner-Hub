
import { supabase } from "@/integrations/supabase/client";
import { addHours, addDays } from "date-fns";

/**
 * CRM AUTOMATION CORE - DESEMBRE PARTNER HUB
 * Tập hợp các helper tạo Task/Notification tự động dựa trên sự kiện.
 * Phase 4: Automation Helpers (Manual Trigger)
 */

// 1. Tự động hóa khi Lead được phân phối cho Sale
export const createLeadAssignedAutomation = async (
  leadId: string, 
  leadName: string, 
  saleId: string, 
  assignedByName: string,
  assignedByUserId: string
) => {
  try {
    // A. Tạo Task gọi điện (Deadline: 4 giờ kể từ lúc gán)
    const dueDate = addHours(new Date(), 4);
    
    const { error: taskError } = await supabase.from("customer_tasks").insert([{
      customer_id: leadId,
      assigned_to: saleId,
      title: `📞 Liên hệ lần đầu: ${leadName}`,
      description: `Lead mới được gán bởi ${assignedByName}. Cần gọi điện thăm dò nhu cầu trong vòng 4h.`,
      task_type: "call",
      priority: "high",
      due_at: dueDate.toISOString(),
      status: "pending",
      assigned_by: assignedByUserId
    }]);

    if (taskError) throw taskError;

    // B. Tạo Notification cho Sale
    const { error: notifyError } = await supabase.from("notifications").insert([{
      recipient_user_id: saleId,
      customer_id: leadId,
      title: "🎯 Lead mới được phân bổ",
      message: `Bạn vừa được ${assignedByName} gán lead mới: ${leadName}. Hãy kiểm tra và liên hệ ngay!`,
      type: "lead_assigned",
      action_url: `/customers/${leadId}`
    }]);

    if (notifyError) throw notifyError;

    // C. Ghi Nhật ký hoạt động (Activity)
    await supabase.from("customer_activities").insert([{
      customer_id: leadId,
      created_by: assignedByUserId,
      activity_type: "note",
      content: `Hệ thống: Lead đã được phân bổ cho Sale ${saleId} bởi ${assignedByName}.`,
    }]);

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

    const { error: taskError } = await supabase.from("customer_tasks").insert([{
      customer_id: customerId,
      assigned_to: saleId,
      title: `📝 Follow-up báo giá: ${customerName}`,
      description: `Kiểm tra phản hồi của khách hàng về báo giá #${quoteId.slice(0, 8)}. Thúc đẩy chốt đơn.`,
      task_type: "quote_follow_up", 
      priority: "medium",
      due_at: dueDate.toISOString(),
      status: "pending"
    }]);

    if (taskError) throw taskError;

    const { error: notifyError } = await supabase.from("notifications").insert([{
      recipient_user_id: saleId,
      customer_id: customerId,
      title: "💰 Nhắc nhở: Follow-up báo giá",
      message: `Báo giá #${quoteId.slice(0, 8)} cho ${customerName} đã gửi được 3 ngày. Hãy liên hệ lại ngay.`,
      type: "task_reminder",
      action_url: `/customers/${customerId}`
    }]);

    if (notifyError) throw notifyError;

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

    const { error: taskError } = await supabase.from("customer_tasks").insert([{
      customer_id: customerId,
      assigned_to: saleId,
      title: `👋 Check-in sau mua: ${customerName}`,
      description: `Khách đã nhận đơn #${orderId.slice(0, 8)} được 7 ngày. Gọi điện hỏi thăm hiệu quả sử dụng.`,
      task_type: "check_in",
      priority: "medium",
      due_at: dueDate.toISOString(),
      status: "pending"
    }]);

    if (taskError) throw taskError;

    const { error: notifyError } = await supabase.from("notifications").insert([{
      recipient_user_id: saleId,
      customer_id: customerId,
      title: "📦 Chăm sóc sau bán hàng",
      message: `Đã đến lúc hỏi thăm ${customerName} về trải nghiệm sử dụng sản phẩm từ đơn #${orderId.slice(0, 8)}.`,
      type: "task_reminder",
      action_url: `/customers/${customerId}`
    }]);

    if (notifyError) throw notifyError;

    return { success: true };
  } catch (error) {
    console.error("Automation Error [PostPurchase]:", error);
    return { success: false, error };
  }
};

// 4. Tự động hóa Follow-up sau sự kiện (Sau 1 ngày)
export const createEventFollowUpAutomation = async (
  customerId: string,
  customerName: string,
  saleId: string,
  eventName: string
) => {
  try {
    const dueDate = addDays(new Date(), 1);

    const { error: taskError } = await supabase.from("customer_tasks").insert([{
      customer_id: customerId,
      assigned_to: saleId,
      title: `🎟️ Follow-up sự kiện: ${eventName}`,
      description: `Khách ${customerName} vừa tham gia sự kiện "${eventName}". Liên hệ để tư vấn phác đồ liên quan.`,
      task_type: "event_invite",
      priority: "medium",
      due_at: dueDate.toISOString(),
      status: "pending"
    }]);

    if (taskError) throw taskError;

    const { error: notifyError } = await supabase.from("notifications").insert([{
      recipient_user_id: saleId,
      customer_id: customerId,
      title: "🎟️ Follow-up sự kiện",
      message: `Đừng quên liên hệ với ${customerName} sau sự kiện ${eventName} nhé!`,
      type: "task_reminder",
      action_url: `/customers/${customerId}`
    }]);

    if (notifyError) throw notifyError;

    return { success: true };
  } catch (error) {
    console.error("Automation Error [EventFollowUp]:", error);
    return { success: false, error };
  }
};

// 5. Cảnh báo Task quá hạn
export const createTaskOverdueNotification = async (
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
      action_url: `/tasks`
    }]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Automation Error [TaskOverdue]:", error);
    return { success: false, error };
  }
};
