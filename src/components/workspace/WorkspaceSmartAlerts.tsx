import React from "react";
import { AlertCircle, Clock, Share2, ShieldAlert } from "lucide-react";
import { WorkspaceSmartAlerts as SmartAlertsData } from "@/types/workspace";

interface Props {
  alerts?: SmartAlertsData;
  loading: boolean;
}

export const WorkspaceSmartAlerts: React.FC<Props> = ({ alerts, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs h-full animate-pulse">
        <div className="h-6 w-1/2 bg-slate-200 rounded mb-6"></div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  const hasAlerts = alerts && Object.values(alerts).some(val => (val || 0) > 0);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <ShieldAlert className="w-5 h-5 text-indigo-500" />
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Smart Alerts</h3>
      </div>

      {!hasAlerts ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <span className="text-3xl mb-2">✨</span>
          <p className="text-xs font-bold text-slate-600">Tuyệt vời, không có cảnh báo nào!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 flex-1">
          {/* Stale Customers */}
          <div className="bg-slate-50 hover:bg-indigo-50/50 rounded-2xl p-4 border border-slate-100 transition-colors group cursor-pointer">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-600">Khách ngủ đông</span>
              <AlertCircle className={`w-4 h-4 ${alerts?.stale_customers_count ? 'text-indigo-500' : 'text-slate-300'}`} />
            </div>
            <div className={`text-2xl font-black ${alerts?.stale_customers_count ? 'text-slate-900' : 'text-slate-300'}`}>
              {alerts?.stale_customers_count || 0}
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">&gt; 7 ngày chưa tương tác</p>
          </div>

          {/* Missing Social */}
          <div className="bg-slate-50 hover:bg-sky-50/50 rounded-2xl p-4 border border-slate-100 transition-colors group cursor-pointer">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-sky-600">Thiếu MXH</span>
              <Share2 className={`w-4 h-4 ${alerts?.customers_missing_social_count ? 'text-sky-500' : 'text-slate-300'}`} />
            </div>
            <div className={`text-2xl font-black ${alerts?.customers_missing_social_count ? 'text-slate-900' : 'text-slate-300'}`}>
              {alerts?.customers_missing_social_count || 0}
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">Chưa có FB/Zalo</p>
          </div>

          {/* Duplicate Risk */}
          <div className="bg-slate-50 hover:bg-rose-50/50 rounded-2xl p-4 border border-slate-100 transition-colors group cursor-pointer">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-rose-600">Trùng dữ liệu</span>
              <ShieldAlert className={`w-4 h-4 ${alerts?.duplicate_channel_risk_count ? 'text-rose-500' : 'text-slate-300'}`} />
            </div>
            <div className={`text-2xl font-black ${alerts?.duplicate_channel_risk_count ? 'text-slate-900' : 'text-slate-300'}`}>
              {alerts?.duplicate_channel_risk_count || 0}
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">Trùng SĐT / Kênh</p>
          </div>

          {/* Overdue Followup */}
          <div className="bg-slate-50 hover:bg-amber-50/50 rounded-2xl p-4 border border-slate-100 transition-colors group cursor-pointer">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-600">Lỡ Follow-up</span>
              <Clock className={`w-4 h-4 ${alerts?.overdue_followups_count ? 'text-amber-500' : 'text-slate-300'}`} />
            </div>
            <div className={`text-2xl font-black ${alerts?.overdue_followups_count ? 'text-slate-900' : 'text-slate-300'}`}>
              {alerts?.overdue_followups_count || 0}
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">Quá hạn chăm sóc</p>
          </div>
        </div>
      )}
    </div>
  );
};
