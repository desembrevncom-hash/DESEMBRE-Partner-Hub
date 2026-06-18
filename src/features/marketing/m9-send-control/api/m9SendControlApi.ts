// import { supabase } from "@/integrations/supabase/client";

// MOCKED API IMPLEMENTATION FOR UI TESTING
// Per accepted scope: "No DB/RPC modification" - the backend does not exist yet.
export const m9SendControlApi = {
  async previewDispatchPlan(batchId: string) {
    return new Promise((resolve) => setTimeout(() => {
      resolve({
        total_queue_rows: 150,
        eligible_ready_rows: 125,
        skipped_blocked_rows: 25,
      });
    }, 800));
  },

  async createDispatchPlan(batchId: string) {
    return new Promise((resolve) => setTimeout(() => {
      resolve({ success: true });
    }, 1000));
  },

  async getDispatchStatus(batchId: string) {
    return new Promise((resolve) => setTimeout(() => {
      resolve({
        total: 150,
        ready: 125,
        skipped: 25,
      });
    }, 600));
  },

  async cancelDispatchPlan(batchId: string) {
    return new Promise((resolve) => setTimeout(() => {
      resolve({ success: true });
    }, 800));
  },

  async getGatewayControls() {
    return new Promise((resolve) => setTimeout(() => {
      resolve([
        {
          scope: "global",
          gateway_enabled: false,
          rate_limit_per_minute: 500,
          updated_at: new Date().toISOString(),
          reason: "Default state",
        }
      ]);
    }, 500));
  },

  async toggleGatewayControl(scope: string, enabled: boolean, reason: string) {
    if (import.meta.env.VITE_APP_ENV === "production" && enabled) {
      throw new Error("Production Safety Violation: gateway_enabled=true is strictly forbidden.");
    }
    return new Promise((resolve) => setTimeout(() => {
      resolve({ success: true });
    }, 500));
  },
};
