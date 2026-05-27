import React, { useEffect, useState } from "react";
import { Zap, Clock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface CustomerAutomationStatusProps {
  customerId: string;
}

export const CustomerAutomationStatus: React.FC<CustomerAutomationStatusProps> = ({ customerId }) => {
  const [activeAutomations, setActiveAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAutomations = async () => {
      if (!customerId) return;
      try {
        // Query automation logs for this customer that are currently running or scheduled
        // In a real system, there might be a dedicated automation_queue or similar
        // For MVP, we check automation_logs with status 'pending', 'scheduled' or 'running'
        const { data, error } = await supabase
          .from('automation_logs')
          .select('id, rule_id, status, error_message, rule:automation_rules(name, rule_type)')
          .eq('customer_id', customerId)
          .in('status', ['pending', 'running', 'scheduled'])
          .order('created_at', { ascending: false });
        
        if (isMounted && data) {
          setActiveAutomations(data);
        }
      } catch (e) {
        console.error("Error fetching automation status", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAutomations();
    return () => { isMounted = false; };
  }, [customerId]);

  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-900 border rounded-lg shadow-sm">
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-amber-500" />
        Automation đang chạy
      </h4>
      
      {loading ? (
        <div className="flex items-center text-sm text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Kiểm tra trạng thái...
        </div>
      ) : activeAutomations.length > 0 ? (
        <div className="space-y-2">
          {activeAutomations.map((auto) => (
            <div key={auto.id} className="flex flex-col gap-1 bg-background p-2 rounded border text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-blue-500" />
                  {auto.rule?.name || "Workflow không xác định"}
                </span>
                <Badge variant="outline" className="text-[10px] uppercase bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  {auto.status}
                </Badge>
              </div>
              {auto.status === 'error' && (
                <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" /> {auto.error_message || "Lỗi không xác định"}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background p-2 rounded border border-dashed">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Không có automation nào đang kích hoạt.
        </div>
      )}
    </div>
  );
};
