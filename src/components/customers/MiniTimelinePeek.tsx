import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Phone, MessageSquare, StickyNote, Activity, Loader2 } from "lucide-react";

interface MiniTimelinePeekProps {
  customer: any;
  children: React.ReactNode;
}

export function MiniTimelinePeek({ customer, children }: MiniTimelinePeekProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadActivities = async (open: boolean) => {
    if (open && !loaded) {
      setLoading(true);
      const { data } = await supabase
        .from("customer_activities")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(3);
      if (data) setActivities(data);
      setLoaded(true);
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="w-3 h-3 text-emerald-500" />;
      case "zalo":
        return <MessageSquare className="w-3 h-3 text-blue-500" />;
      case "note":
        return <StickyNote className="w-3 h-3 text-amber-500" />;
      default:
        return <Activity className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <Popover onOpenChange={loadActivities}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">
          Lịch sử gần đây
        </h4>
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-2 items-start text-xs">
                <div className="mt-0.5">{getIcon(act.activity_type)}</div>
                <div>
                  <div className="font-medium text-slate-700">
                    {act.content || act.activity_type}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {format(new Date(act.created_at), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500 text-center py-2">Chưa có lịch sử tương tác</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
