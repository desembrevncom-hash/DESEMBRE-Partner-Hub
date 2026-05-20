import { supabase } from "@/integrations/supabase/client";
import { addHours, addDays } from "date-fns";
import { createAutomationLog } from "@/lib/automationLogs";

/**
 * CRM AUTOMATION CORE - DESEMBRE PARTNER HUB
 * Tập hợp các helper tạo Task/Notification tự động dựa trên sự kiện.
 * Đã tối ưu (Audit Passed):
 * - Chống trùng lặp (Idempotency)
 * - Đầy đủ Activity Log
 * - Dùng Safe Runner lưu vào automation_logs
 */

interface AutomationStep {
  name: string;
  run: () => Promise<any>;
}

const runAutomationSteps = async (
  automationType: string,
  customerId: string | null,
  leadId: string | null,
  steps: AutomationStep[],
  createdByUserId: string | null = null
) => {
  const expectedSteps = steps.map(s => s.name);
  const stepResults: { step: string; status: "success" | "failed"; error?: string }[] = [];
  const errorMessages: string[] = [];

  let taskId: string | null = null;
  let notificationId: string | null = null;

  for (const step of steps) {
    try {
      const res = await step.run();
      if (res && res.error) {
        throw res.error;
      }
      
      const data = res?.data;
      if (data && Array.isArray(data) && data.length > 0) {
        const item = data[0];
        if (step.name === "create task" && item.id) {
          taskId = item.id;
        } else if (step.name === "create notification" && item.id) {
          notificationId = item.id;
        }
      }
      
      stepResults.push({ step: step.name, status: "success" });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      stepResults.push({ step: step.name, status: "failed", error: errMsg });
      errorMessages.push(`${step.name}: ${errMsg}`);
    }
  }

  const successCount = stepResults.filter(r => r.status === "success").length;
  const failCount = stepResults.filter(r => r.status === "failed").length;

  let finalStatus: "success" | "partial_failed" | "failed" = "success";
  if (failCount === 0) {
    finalStatus = "success";
  } else if (successCount > 0) {
    finalStatus = "partial_failed";
  } else {
    finalStatus = "failed";
  }

  const errorMsg = errorMessages.length > 0 ? errorMessages.join("; ") : null;

  try {
    await createAutomationLog({
      automation_type: automationType,
      customer_id: customerId,
      lead_id: leadId,
      task_id: taskId,
      notification_id: notificationId,
      status: finalStatus,
      error_message: errorMsg,
      metadata: {
        expected_steps: expectedSteps,
        step_results: stepResults
      },
      created_by: createdByUserId
    });
  } catch (logErr) {
    console.error("Failed to write automation log:", logErr);
  }

  return {
    success: finalStatus !== "failed",
    status: finalStatus,
    error: errorMsg,
    warnings: finalStatus === "partial_failed" ? errorMsg : null
  };
};

// 1. Tự động hoá khi Lead được phân phối cho Sale
export const createLeadAssignedAutomation = async (
  leadId: string, 
  leadName: string, 
  saleId: string, 
  assignedByName: string,
  assignedByUserId: string
) => {
  try {
    // Kiểm tra chống trùng Task
    const { data: existingTasks } = await supabase
      .from("customer_tasks")
      .select("id")
      .eq("customer_id", leadId)
      .eq("status", "pending")
      .eq("task_type", "call")
      .limit(1);

    const shouldCreateTask = !existingTasks || existingTasks.length === 0;

    // Kiểm tra chống trùng Notification
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("id")
      .eq("recipient_user_id", saleId)
      .eq("customer_id", leadId)
      .eq("type", "lead_assigned")
      .is("read_at", null)
      .limit(1);

    const shouldCreateNotif = !existingNotifs || existingNotifs.length === 0;

    const steps: AutomationStep[] = [];

    if (shouldCreateTask) {
      const dueDate = addHours(new Date(), 4);
      steps.push({
        name: "create task",
        run: () => supabase.from("customer_tasks").insert([{
          customer_id: null,
          lead_id: leadId,
          assigned_to: saleId,
          title: `📞 Liên hệ lần đầu: ${leadName}`,
          description: `Lead mới được gán bởi ${assignedByName}. Cần gọi điện thăm dò nhu cầu trong vòng 4h.`,
          task_type: "call",
          priority: "high",
          due_at: dueDate.toISOString(),
          status: "pending",
          assigned_by: assignedByUserId
        }]).select("id")
      });
    }

    if (shouldCreateNotif) {
      steps.push({
        name: "create notification",
        run: () => supabase.from("notifications").insert([{
          recipient_user_id: saleId,
          customer_id: leadId,
          title: "🎯 Lead mới được phân bổ",
          message: `Bạn vừa được ${assignedByName} gán lead mới: ${leadName}. Hãy kiểm tra và liên hệ ngay!`,
          type: "lead_assigned",
          action_url: `/customers/${leadId}`
        }]).select("id")
      });
    }

    steps.push({
      name: "create activity",
      run: () => supabase.from("customer_activities").insert([{
        customer_id: leadId,
        created_by: assignedByUserId,
        activity_type: "note",
        content: `Hệ thống: Lead đã được phân bổ cho Sale ${saleId} bởi ${assignedByName}.`,
      }])
    });

    return await runAutomationSteps(
      "lead_assigned",
      null,
      leadId,
      steps,
      assignedByUserId
    );
  } catch (error) {
    console.error("Automation Error [LeadAssigned]:", error);
    return { success: false, error };
  }
};

// 2. Tự động hoá Follow-up báo giá (Sau 3 ngày)
export const createQuoteFollowUpAutomation = async (
  customerId: string,
  customerName: string,
  saleId: string,
  quoteId: string
) => {
  try {
    const { data: existingTasks } = await supabase
      .from("customer_tasks")
      .select("id")
      .eq("customer_id", customerId)
      .eq("status", "pending")
      .eq("task_type", "quote_follow_up")
      .limit(1);

    const shouldCreateTask = !existingTasks || existingTasks.length === 0;

    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("id")
      .eq("recipient_user_id", saleId)
      .eq("customer_id", customerId)
      .eq("type", "task_reminder")
      .ilike("title", "%Follow-up báo giá%")
      .is("read_at", null)
      .limit(1);

    const shouldCreateNotif = !existingNotifs || existingNotifs.length === 0;

    const steps: AutomationStep[] = [];

    if (shouldCreateTask) {
      const dueDate = addDays(new Date(), 3);
      steps.push({
        name: "create task",
        run: () => supabase.from("customer_tasks").insert([{
          customer_id: customerId,
          assigned_to: saleId,
          title: `📝 Follow-up báo giá: ${customerName}`,
          description: `Kiểm tra phản hồi của khách hàng về báo giá #${quoteId.slice(0, 8)}. Thúc đẩy chốt đơn.`,
          task_type: "quote_follow_up", 
          priority: "medium",
          due_at: dueDate.toISOString(),
          status: "pending"
        }]).select("id")
      });
    }

    if (shouldCreateNotif) {
      steps.push({
        name: "create notification",
        run: () => supabase.from("notifications").insert([{
          recipient_user_id: saleId,
          customer_id: customerId,
          title: "⏰ Nhắc nhở: Follow-up báo giá",
          message: `Báo giá #${quoteId.slice(0, 8)} cho ${customerName} đã gửi được 3 ngày. Hãy liên hệ lại ngay.`,
          type: "task_reminder",
          action_url: `/customers/${customerId}`
        }]).select("id")
      });
    }

    steps.push({
      name: "create activity",
      run: () => supabase.from("customer_activities").insert([{
        customer_id: customerId,
        created_by: null, 
        activity_type: "note",
        content: `Hệ thống: Tạo nhắc nhở Follow-up báo giá tự động #${quoteId.slice(0, 8)}.`,
      }])
    });

    return await runAutomationSteps(
      "quote_follow_up",
      customerId,
      null,
      steps,
      null
    );
  } catch (error) {
    console.error("Automation Error [QuoteFollowUp]:", error);
    return { success: false, error };
  }
};

// 3. Tự động hoá Check-in sau mua (Sau 7 ngày)
export const createPostPurchaseCheckinAutomation = async (
  customerId: string,
  customerName: string,
  saleId: string,
  orderId: string
) => {
  try {
    const { data: existingTasks } = await supabase
      .from("customer_tasks")
      .select("id")
      .eq("customer_id", customerId)
      .eq("status", "pending")
      .eq("task_type", "check_in")
      .limit(1);

    const shouldCreateTask = !existingTasks || existingTasks.length === 0;

    const steps: AutomationStep[] = [];

    if (shouldCreateTask) {
      const dueDate = addDays(new Date(), 7);
      steps.push({
        name: "create task",
        run: () => supabase.from("customer_tasks").insert([{
          customer_id: customerId,
          assigned_to: saleId,
          title: `🛍️ Check-in sau mua: ${customerName}`,
          description: `Khách đã nhận đơn #${orderId.slice(0, 8)} được 7 ngày. Gọi điện hỏi thăm hiệu quả sử dụng.`,
          task_type: "check_in",
          priority: "medium",
          due_at: dueDate.toISOString(),
          status: "pending"
        }]).select("id")
      });
    }

    steps.push({
      name: "create notification",
      run: () => supabase.from("notifications").insert([{
        recipient_user_id: saleId,
        customer_id: customerId,
        title: "❤️ Chăm sóc sau bán hàng",
        message: `Đã đến lúc hỏi thăm ${customerName} về trải nghiệm sử dụng sản phẩm từ đơn #${orderId.slice(0, 8)}.`,
        type: "task_reminder",
        action_url: `/customers/${customerId}`
      }]).select("id")
    });

    steps.push({
      name: "create activity",
      run: () => supabase.from("customer_activities").insert([{
        customer_id: customerId,
        created_by: null, 
        activity_type: "note",
        content: `Hệ thống: Lên lịch check-in sau mua tự động cho đơn #${orderId.slice(0, 8)}.`,
      }])
    });

    return await runAutomationSteps(
      "post_purchase_checkin",
      customerId,
      null,
      steps,
      null
    );
  } catch (error) {
    console.error("Automation Error [PostPurchase]:", error);
    return { success: false, error };
  }
};

// 4. Tự động hoá Follow-up sau sự kiện (Sau 1 ngày)
export const createEventFollowUpAutomation = async (
  customerId: string,
  customerName: string,
  saleId: string,
  eventName: string
) => {
  try {
    const dueDate = addDays(new Date(), 1);
    const steps: AutomationStep[] = [];

    steps.push({
      name: "create task",
      run: () => supabase.from("customer_tasks").insert([{
        customer_id: customerId,
        assigned_to: saleId,
        title: `🎪 Follow-up sự kiện: ${eventName}`,
        description: `Khách ${customerName} vừa tham gia sự kiện "${eventName}". Liên hệ để tư vấn phác đồ liên quan.`,
        task_type: "event_invite",
        priority: "medium",
        due_at: dueDate.toISOString(),
        status: "pending"
      }]).select("id")
    });

    steps.push({
      name: "create notification",
      run: () => supabase.from("notifications").insert([{
        recipient_user_id: saleId,
        customer_id: customerId,
        title: "🎟️ Follow-up sự kiện",
        message: `Đừng quên liên hệ với ${customerName} sau sự kiện ${eventName} nhé!`,
        type: "task_reminder",
        action_url: `/customers/${customerId}`
      }]).select("id")
    });

    steps.push({
      name: "create activity",
      run: () => supabase.from("customer_activities").insert([{
        customer_id: customerId,
        created_by: null,
        activity_type: "note",
        content: `Hệ thống: Tạo nhắc nhở Follow-up sau sự kiện "${eventName}".`,
      }])
    });

    return await runAutomationSteps(
      "event_follow_up",
      customerId,
      null,
      steps,
      null
    );
  } catch (error) {
    console.error("Automation Error [EventFollowUp]:", error);
    return { success: false, error };
  }
};

// 5. Cảnh báo Task quá hạn
export const createTaskOverdueNotification = async (
  userId: string,
  taskTitle: string,
  taskId: string,
  customerId?: string | null
) => {
  try {
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("id")
      .eq("recipient_user_id", userId)
      .eq("type", "task_overdue")
      .ilike("message", `%${taskTitle}%`)
      .is("read_at", null)
      .limit(1);

    if (existingNotifs && existingNotifs.length > 0) return { success: true };

    const steps: AutomationStep[] = [];

    steps.push({
      name: "create notification",
      run: () => supabase.from("notifications").insert([{
        recipient_user_id: userId,
        customer_id: customerId || null,
        title: "🚨 Cảnh báo: Task quá hạn",
        message: `Công việc "${taskTitle}" đã quá hạn xử lý. Vui lòng cập nhật trạng thái ngay.`,
        type: "task_overdue",
        action_url: `/tasks`
      }]).select("id")
    });

    if (customerId) {
      steps.push({
        name: "create activity",
        run: () => supabase.from("customer_activities").insert([{
          customer_id: customerId,
          created_by: null,
          activity_type: "note",
          content: `Hệ thống: Gửi cảnh báo task quá hạn: "${taskTitle}".`,
        }])
      });
    }

    return await runAutomationSteps(
      "task_overdue",
      customerId || null,
      null,
      steps,
      null
    );
  } catch (error) {
    console.error("Automation Error [TaskOverdue]:", error);
    return { success: false, error };
  }
};

// 6. Cảnh báo khách sắp bị thu hồi (Customer Reclamation Alert)
export const createCustomerAtRiskAutomation = async (
  customer: any,
  ownerUserId: string,
  reason: string
) => {
  try {
    if (!customer?.id || !ownerUserId) {
      return { success: false, error: "Missing customer ID or owner user ID" };
    }

    const { data: existingTasks } = await supabase
      .from("customer_tasks")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("status", "pending")
      .eq("task_type", "follow_up")
      .ilike("title", "%Chăm lại khách trước khi bị thu hồi%")
      .limit(1);

    const shouldCreateTask = !existingTasks || existingTasks.length === 0;

    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("id")
      .eq("recipient_user_id", ownerUserId)
      .eq("customer_id", customer.id)
      .eq("type", "customer_at_risk")
      .is("read_at", null)
      .limit(1);

    const shouldCreateNotification = !existingNotifs || existingNotifs.length === 0;

    const steps: AutomationStep[] = [];

    if (shouldCreateTask) {
      const dueDate = addDays(new Date(), 1);
      steps.push({
        name: "create task",
        run: () => supabase.from("customer_tasks").insert([{
          customer_id: customer.id,
          assigned_to: ownerUserId,
          assigned_by: null, 
          task_type: "follow_up",
          title: "Chăm lại khách trước khi bị thu hồi",
          note: reason,
          priority: "high",
          status: "pending",
          due_at: dueDate.toISOString(),
          owner_tele_id: customer.owner_tele_id || null
        }]).select("id")
      });
    }

    if (shouldCreateNotification) {
      steps.push({
        name: "create notification",
        run: () => supabase.from("notifications").insert([{
          recipient_user_id: ownerUserId,
          customer_id: customer.id,
          type: "customer_at_risk",
          priority: "high",
          title: "Khách sắp bị thu hồi",
          message: reason,
          action_url: `/customers/${customer.id}`
        }]).select("id")
      });
    }

    steps.push({
      name: "create activity",
      run: () => supabase.from("customer_activities").insert([{
        customer_id: customer.id,
        created_by: null, 
        activity_type: "note",
        title: "Hệ thống cảnh báo khách sắp bị thu hồi",
        content: reason
      }])
    });

    return await runAutomationSteps(
      "customer_at_risk",
      customer.id,
      null,
      steps,
      null
    );
  } catch (error) {
    console.error("Automation Error [CustomerAtRisk]:", error);
    return { success: false, error };
  }
};

// 7. Khách được gán owner_sale_id / owner_tele_id
export const createCustomerAssignedAutomation = async (
  customerId: string,
  customerName: string,
  assignToId: string,
  assignedByName: string,
  assignedByUserId: string
) => {
  try {
    const { data: existingTasks } = await supabase
      .from("customer_tasks")
      .select("id")
      .eq("customer_id", customerId)
      .eq("status", "pending")
      .eq("task_type", "call")
      .limit(1);

    const shouldCreateTask = !existingTasks || existingTasks.length === 0;

    const steps: AutomationStep[] = [];

    if (shouldCreateTask) {
      const dueDate = addDays(new Date(), 2);
      steps.push({
        name: "create task",
        run: () => supabase.from("customer_tasks").insert([{
          customer_id: customerId,
          assigned_to: assignToId,
          title: `👋 Chào mừng về chăm sóc khách hàng: ${customerName}`,
          description: `Khách hàng vừa được giao cho bạn bởi ${assignedByName}. Hãy gọi điện làm quen và cập nhật tình hình.`,
          task_type: "call",
          priority: "normal",
          due_at: dueDate.toISOString(),
          status: "pending",
          assigned_by: assignedByUserId
        }]).select("id")
      });
    }

    steps.push({
      name: "create notification",
      run: () => supabase.from("notifications").insert([{
        recipient_user_id: assignToId,
        customer_id: customerId,
        title: "Khách hàng mới được giao",
        message: `Bạn được ${assignedByName} giao phụ trách khách hàng: ${customerName}.`,
        type: "customer_assigned",
        action_url: `/customers/${customerId}`
      }]).select("id")
    });

    steps.push({
      name: "create activity",
      run: () => supabase.from("customer_activities").insert([{
        customer_id: customerId,
        created_by: assignedByUserId,
        activity_type: "note",
        content: `Hệ thống: Khách hàng được giao phụ trách cho Sale/Tele bởi ${assignedByName}.`
      }])
    });

    return await runAutomationSteps(
      "customer_assigned",
      customerId,
      null,
      steps,
      assignedByUserId
    );
  } catch (error) {
    console.error("Automation Error [CustomerAssigned]:", error);
    return { success: false, error };
  }
};

// 8. Khách lâu chưa mua (Reorder Reminder)
export const createReorderReminderAutomation = async (
  customerId: string,
  customerName: string,
  ownerId: string
) => {
  try {
    if (!ownerId) return { success: false, error: "No owner to assign" };

    const { data: existingTasks } = await supabase
      .from("customer_tasks")
      .select("id")
      .eq("customer_id", customerId)
      .eq("status", "pending")
      .eq("task_type", "follow_up")
      .ilike("title", "%Nhắc nhở Reorder%")
      .limit(1);

    const shouldCreateTask = !existingTasks || existingTasks.length === 0;

    const steps: AutomationStep[] = [];

    if (shouldCreateTask) {
      const dueDate = addDays(new Date(), 2);
      steps.push({
        name: "create task",
        run: () => supabase.from("customer_tasks").insert([{
          customer_id: customerId,
          assigned_to: ownerId,
          title: `🔁 Nhắc nhở Reorder: ${customerName}`,
          description: `Khách hàng đã lâu chưa nhập hàng. Hãy liên hệ để kiểm tra tồn kho và giới thiệu ưu đãi mới.`,
          task_type: "follow_up",
          priority: "normal",
          due_at: dueDate.toISOString(),
          status: "pending"
        }]).select("id")
      });
    }

    steps.push({
      name: "create notification",
      run: () => supabase.from("notifications").insert([{
        recipient_user_id: ownerId,
        customer_id: customerId,
        title: "Nhắc nhở Khách hàng Reorder",
        message: `Khách hàng ${customerName} lâu chưa mua hàng. Hãy liên hệ chăm sóc ngay.`,
        type: "follow_up_reminder",
        priority: "normal",
        action_url: `/customers/${customerId}`
      }]).select("id")
    });

    steps.push({
      name: "create activity",
      run: () => supabase.from("customer_activities").insert([{
        customer_id: customerId,
        created_by: null,
        activity_type: "note",
        content: `Hệ thống: Tạo nhắc nhở định kỳ (Reorder) cho khách hàng.`
      }])
    });

    return await runAutomationSteps(
      "reorder_reminder",
      customerId,
      null,
      steps,
      null
    );
  } catch (error) {
    console.error("Automation Error [ReorderReminder]:", error);
    return { success: false, error };
  }
};
