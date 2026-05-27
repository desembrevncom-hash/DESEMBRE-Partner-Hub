import { supabase } from "@/integrations/supabase/client";

let searchTimeout: NodeJS.Timeout | null = null;
let lastDrawerOpenTime = 0;

export const trackKanbanDrag = async (stage: string, success: boolean) => {
  try {
    await supabase.rpc('log_pilot_usage_metric', {
      p_page_key: 'customers',
      p_action_key: 'kanban_drag',
      p_metric_data: { stage, success }
    });
  } catch (e) {
    console.warn("Tracking error", e);
  }
};

export const trackQuickLog = async (resultType: string) => {
  try {
    await supabase.rpc('log_pilot_usage_metric', {
      p_page_key: 'customers',
      p_action_key: 'quick_log',
      p_metric_data: { resultType }
    });
  } catch (e) {
    console.warn("Tracking error", e);
  }
};

export const trackSearch = (keyword: string, resultCount?: number) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  if (!keyword.trim()) return;

  searchTimeout = setTimeout(async () => {
    try {
      await supabase.rpc('log_pilot_usage_metric', {
        p_page_key: 'customers',
        p_action_key: 'search',
        p_metric_data: { 
          keyword_length: keyword.length,
          result_count: resultCount
        }
      });
    } catch (e) {
      console.warn("Tracking error", e);
    }
  }, 800);
};

export const trackFilterUsage = async (filterId: string) => {
  try {
    await supabase.rpc('log_pilot_usage_metric', {
      p_page_key: 'customers',
      p_action_key: 'filter_apply',
      p_metric_data: { filterId }
    });
  } catch (e) {
    console.warn("Tracking error", e);
  }
};

export const trackDrawerOpen = async (customerId: string) => {
  // Throttle to 1 log per 30 seconds per session to avoid spam
  const now = Date.now();
  if (now - lastDrawerOpenTime < 30000) return;
  lastDrawerOpenTime = now;
  
  try {
    await supabase.rpc('log_pilot_usage_metric', {
      p_page_key: 'customers',
      p_action_key: 'drawer_open',
      p_metric_data: { customerId }
    });
  } catch (e) {
    console.warn("Tracking error", e);
  }
};

export const trackRenderPerformance = (componentName: string, startTime: number) => {
  const duration = performance.now() - startTime;
  if (duration > 300) {
    console.warn(`[PERF] ${componentName} slow render: ${Math.round(duration)}ms`);
    // Optional: send to backend if we want to trace heavy clients
  }
};
