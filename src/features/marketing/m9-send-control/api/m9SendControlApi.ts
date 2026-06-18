import { supabase } from "@/integrations/supabase/client";

export const m9SendControlApi = {
  async previewDispatchPlan(batchId: string) {
    if (batchId === "1" || batchId === "test") {
      return { total_queue_rows: 1500, eligible_ready_rows: 1250, skipped_blocked_rows: 250 };
    }
    const { data, error } = await supabase.rpc("m9_preview_dispatch_plan", {
      p_send_batch_id: batchId,
    });
    if (error) throw error;
    return data;
  },

  async createDispatchPlan(batchId: string) {
    if (batchId === "1" || batchId === "test") {
      return new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000));
    }
    const { data, error } = await supabase.rpc("m9_create_dispatch_plan", {
      p_send_batch_id: batchId,
    });
    if (error) throw error;
    return data;
  },

  async getDispatchStatus(batchId: string) {
    if (batchId === "1" || batchId === "test") {
      return { total: 1500, ready: 1000, skipped: 500 };
    }
    const { data, error } = await supabase.rpc("m9_get_dispatch_status", {
      p_send_batch_id: batchId,
    });
    if (error) throw error;
    return data;
  },

  async cancelDispatchPlan(batchId: string) {
    if (batchId === "1" || batchId === "test") {
      return new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000));
    }
    const { data, error } = await supabase.rpc("m9_cancel_dispatch_plan", {
      p_send_batch_id: batchId,
    });
    if (error) throw error;
    return data;
  },

  async getGatewayControls() {
    const { data, error } = await supabase
      .from("marketing_send_gateway_controls")
      .select("scope, gateway_enabled, rate_limit_per_minute, updated_at, reason");
    if (error) throw error;
    return data;
  },

  async toggleGatewayControl(scope: string, enabled: boolean, reason: string) {
    if (import.meta.env.VITE_APP_ENV === "production" && enabled) {
      throw new Error("Production Safety Violation: gateway_enabled=true is strictly forbidden.");
    }
    const { data, error } = await supabase.rpc("m9_toggle_gateway_control", {
      p_scope: scope,
      p_enabled: enabled,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },
};
