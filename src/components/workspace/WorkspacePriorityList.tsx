import React from "react";
import { Zap, Clock, AlertCircle, Phone, Package, CalendarClock, PhoneCall, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspacePriorityItem, WorkspaceTeamRisk } from "@/types/workspace";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  priorities: WorkspacePriorityItem[];
  teamRisks?: WorkspaceTeamRisk[];
  loading: boolean;
  onOpenCustomer: (id: string, action?: "note" | "task" | "followup" | "call") => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent": return "bg-rose-100 text-rose-700 border-rose-200";
    case "high": return "bg-amber-100 text-amber-700 border-amber-200";
    case "medium": return "bg-blue-100 text-blue-700 border-blue-200";
    case "low": return "bg-slate-100 text-slate-700 border-slate-200";
    default: return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "overdue_task": return <AlertCircle className="w-5 h-5 text-rose-500" />;
    case "follow_up": return <Clock className="w-5 h-5 text-amber-500" />;
    case "upcoming_event": return <CalendarClock className="w-5 h-5 text-purple-500" />;
    case "stale_customer": return <PhoneOff className="w-5 h-5 text-slate-400" />;
    case "quotation_pending": return <FileText className="w-5 h-5 text-blue-500" />;
    case "call_lead": return <PhoneCall className="w-5 h-5 text-blue-500" />;
    default: return <Zap className="w-5 h-5 text-amber-500" />;
  }
};

export const WorkspacePriorityList: React.FC<Props> = ({ priorities, teamRisks, loading, onOpenCustomer }) => {
  const navigate = useNavigate();

  const handleAction = (item: WorkspacePriorityItem) => {
    if (item.action_type === 'open_customer' && item.customer_id) {
      onOpenCustomer(item.customer_id);
    } else if (item.action_type === 'call' && item.customer_id) {
      onOpenCustomer(item.customer_id, "call");
    } else if (item.action_type === 'open_calendar') {
      navigate({ to: "/calendar" });
    } else if (item.deep_link) {
      navigate({ to: item.deep_link as any });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs mb-8 animate-pulse">
        <div className="h-6 w-1/4 bg-slate-200 rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-8">
      {/* TEAM RISKS (Only for Admins) */}
      {teamRisks && teamRisks.length > 0 && (
        <div className="bg-rose-50/50 rounded-3xl border border-rose-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-black uppercase tracking-wider text-rose-900">Quản trị rủi ro Team</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teamRisks.map(risk => (
              <div key={risk.id} className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm flex items-start gap-3">
                <span className="text-rose-500 mt-0.5">
                  {risk.type === 'overdue_followup' ? <Clock className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                </span>
                <p className="text-xs font-medium text-slate-700 leading-relaxed">{risk.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TODAY PRIORITIES */}
      <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Việc ưu tiên hôm nay</h3>
          <span className="ml-2 px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
            {priorities.length} việc
          </span>
        </div>

        {priorities.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <span className="text-4xl mb-3">🎉</span>
            <h4 className="text-sm font-black text-slate-700">Tuyệt vời! Không có việc khẩn cấp.</h4>
            <p className="text-xs text-slate-500 mt-1">Bạn đang làm rất tốt, mọi công việc đều đã hoàn tất đúng hạn.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {priorities.map((item) => (
              <div 
                key={item.id} 
                className="group flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-slate-100 hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/5 rounded-2xl transition-all gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                    {getTypeIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                      {item.customer_name && (
                        <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{item.customer_name}</span>
                      )}
                      <span>•</span>
                      <span>{item.reason}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto w-full md:w-auto">
                  <Button 
                    size="sm" 
                    className="w-full md:w-auto bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs"
                    onClick={() => handleAction(item)}
                  >
                    {item.action_label || 'Xử lý'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component missing from lucid-react import in this file scope
const PhoneOff = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" x2="2" y1="2" y2="22"/></svg>
);
