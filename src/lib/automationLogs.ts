import { supabase } from "@/integrations/supabase/client";

export interface AutomationLogInput {
  automation_type: string;
  customer_id?: string | null;
  lead_id?: string | null;
  task_id?: string | null;
  notification_id?: string | null;
  status: string;
  error_message?: string | null;
  metadata?: any;
  created_by?: string | null;
}

export async function createAutomationLog(input: AutomationLogInput) {
  try {
    const { data, error } = await supabase
      .from("automation_logs")
      .insert([input]);
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Error creating automation log:", err);
    return null;
  }
}
