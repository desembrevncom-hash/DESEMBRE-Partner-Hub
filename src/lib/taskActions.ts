import { supabase } from "@/integrations/supabase/client";

export const handleStartTaskAction = async (taskId: string) => {
  const { error } = await supabase
    .from("customer_tasks")
    .update({ 
      status: "in_progress",
      started_at: new Date().toISOString()
    })
    .eq("id", taskId);
  if (error) throw error;
};

export const handleCompleteTaskAction = async (task: any, userId?: string) => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("customer_tasks")
    .update({ 
      status: "completed",
      completed_at: now
    })
    .eq("id", task.id);
  if (error) throw error;

  if (task.customer_id) {
    const isVisit = task.task_type === "visit" || task.task_type === "check_in";
    await supabase.from("customer_activities").insert([{
      customer_id: task.customer_id,
      created_by: userId,
      activity_type: isVisit ? "check_in" : "task_completed",
      title: isVisit ? "Hoàn thành Check-in CSKH" : "Hoàn thành công việc",
      content: isVisit 
        ? `Đã hoàn thành thăm hỏi/gặp mặt: "${task.title}"`
        : `Đã hoàn thành công việc: "${task.title}"`
    }]);
  }
};

export const handleNoAnswerTaskAction = async (task: any, userId?: string, nextCallDate?: string | null) => {
  const updates: any = {
    result: "no_answer"
  };
  
  if (nextCallDate) {
    updates.due_at = new Date(nextCallDate).toISOString();
    updates.status = "pending";
  }

  const { error } = await supabase
    .from("customer_tasks")
    .update(updates)
    .eq("id", task.id);
  if (error) throw error;

  if (task.customer_id) {
    const timeText = nextCallDate ? ` - Hẹn gọi lại vào lúc ${new Date(nextCallDate).toLocaleString('vi-VN')}` : "";
    await supabase.from("customer_activities").insert([{
      customer_id: task.customer_id,
      created_by: userId,
      activity_type: "call",
      title: "Cuộc gọi không nhấc máy",
      content: `Hệ thống: Gọi chăm sóc nhưng khách hàng không bắt máy${timeText}.`
    }]);
  }
};

export const handleWrongNumberTaskAction = async (task: any, userId?: string) => {
  const { error } = await supabase
    .from("customer_tasks")
    .update({ 
      status: "completed",
      completed_at: new Date().toISOString(),
      result: "wrong_number"
    })
    .eq("id", task.id);
  if (error) throw error;

  if (task.customer_id) {
    // Log activity
    await supabase.from("customer_activities").insert([{
      customer_id: task.customer_id,
      created_by: userId,
      activity_type: "call",
      title: "Sai số điện thoại",
      content: `Hệ thống: Gọi điện liên hệ nhưng phát hiện số điện thoại sai hoặc không liên lạc được.`
    }]);

    // Update customer lifecycle to lost
    await supabase
      .from("customers")
      .update({ lifecycle_stage: "lost" })
      .eq("id", task.customer_id);
  }
};

export const handleInterestedTaskAction = async (
  task: any, 
  userId?: string, 
  nextAction: 'follow_up' | 'transfer_to_sale' = 'follow_up'
) => {
  const { error } = await supabase
    .from("customer_tasks")
    .update({ 
      result: "interested",
      next_action: nextAction,
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", task.id);
  if (error) throw error;

  if (task.customer_id) {
    const actionText = nextAction === 'transfer_to_sale' ? "Yêu cầu chuyển giao Sale" : "Hẹn follow-up";
    await supabase.from("customer_activities").insert([{
      customer_id: task.customer_id,
      created_by: userId,
      activity_type: "note",
      title: "Khách hàng quan tâm",
      content: `Hệ thống: Khách hàng bày tỏ sự quan tâm đặc biệt. Hành động tiếp theo: ${actionText}`
    }]);

    const updates: any = { potential_level: "hot" };
    if (nextAction === 'transfer_to_sale') {
      updates.lifecycle_stage = "qualified";
      updates.care_model = "tele_qualified_then_sale";
    }
    await supabase
      .from("customers")
      .update(updates)
      .eq("id", task.customer_id);
  }
};

export const handleRescheduleTaskAction = async (task: any, userId?: string, nextCallDate: string) => {
  const { error } = await supabase
    .from("customer_tasks")
    .update({ 
      due_at: new Date(nextCallDate).toISOString(),
      status: "pending",
      result: "call_back_later"
    })
    .eq("id", task.id);
  if (error) throw error;

  if (task.customer_id) {
    await supabase.from("customer_activities").insert([{
      customer_id: task.customer_id,
      created_by: userId,
      activity_type: "call",
      title: "Hẹn gọi lại sau",
      content: `Hệ thống: Lên lịch hẹn gọi lại vào lúc ${new Date(nextCallDate).toLocaleString('vi-VN')}.`
    }]);
  }
};

export const handleTransferToSaleTaskAction = async (task: any, userId?: string) => {
  const { error } = await supabase
    .from("customer_tasks")
    .update({ 
      result: "transfer_to_sale",
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", task.id);
  if (error) throw error;

  if (task.customer_id) {
    await supabase.from("customer_activities").insert([{
      customer_id: task.customer_id,
      created_by: userId,
      activity_type: "handoff",
      title: "Yêu cầu chuyển giao Sale",
      content: `Hệ thống: Telesale đã đánh giá đủ điều kiện và yêu cầu chuyển giao cho Sale chăm sóc.`
    }]);

    await supabase
      .from("customers")
      .update({ 
        lifecycle_stage: "qualified",
        care_model: "tele_qualified_then_sale"
      })
      .eq("id", task.customer_id);
  }
};
