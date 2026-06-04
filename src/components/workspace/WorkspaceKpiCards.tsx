import React from "react";
import { Phone, Clock, UserCheck, FileText, Package, AlertCircle } from "lucide-react";
import { WorkspaceCounters } from "@/types/workspace";
import { useNavigate } from "@tanstack/react-router";
import { workspaceKpiToRoute } from "@/lib/workspaceFilterMapping";

interface Props {
  counters?: WorkspaceCounters;
  loading: boolean;
}

export const WorkspaceKpiCards: React.FC<Props> = ({ counters, loading }) => {
  const navigate = useNavigate();

  const handleCardClick = (type: string) => {
    const route = workspaceKpiToRoute(type);
    if (!route) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate({ to: route.path as any, search: route.search as any });
  };

  const kpiItems = [
    {
      id: "lead",
      title: "LEAD CẦN GỌI",
      value: counters?.lead_to_call_count || 0,
      icon: (
        <Phone className="w-8 h-8 md:w-12 md:h-12 text-blue-50/50 absolute right-2 bottom-2 md:right-4 md:bottom-4" />
      ),
      color: "text-blue-600",
      bgHover: "hover:bg-blue-50/50",
    },
    {
      id: "followup",
      title: "FOLLOW-UP HÔM NAY",
      value: counters?.follow_up_today_count || 0,
      icon: (
        <Clock className="w-8 h-8 md:w-12 md:h-12 text-orange-50/50 absolute right-2 bottom-2 md:right-4 md:bottom-4" />
      ),
      color: "text-orange-600",
      bgHover: "hover:bg-orange-50/50",
    },
    {
      id: "checkin",
      title: "CẦN CHECK-IN",
      value: counters?.check_in_today_count || 0,
      icon: (
        <UserCheck className="w-8 h-8 md:w-12 md:h-12 text-emerald-50/50 absolute right-2 bottom-2 md:right-4 md:bottom-4" />
      ),
      color: "text-emerald-600",
      bgHover: "hover:bg-emerald-50/50",
    },
    {
      id: "quotation",
      title: "BÁO GIÁ CHƯA CHỐT",
      value: counters?.quotation_pending_count || 0,
      icon: (
        <FileText className="w-8 h-8 md:w-12 md:h-12 text-purple-50/50 absolute right-2 bottom-2 md:right-4 md:bottom-4" />
      ),
      color: "text-purple-600",
      bgHover: "hover:bg-purple-50/50",
    },
    {
      id: "draft_order",
      title: "ĐƠN NHÁP / CHỜ DUYỆT",
      value: counters?.draft_order_count || 0,
      icon: (
        <Package className="w-8 h-8 md:w-12 md:h-12 text-slate-50/50 absolute right-2 bottom-2 md:right-4 md:bottom-4" />
      ),
      color: "text-slate-800",
      bgHover: "hover:bg-slate-50/50",
    },
    {
      id: "overdue",
      title: "SẮP THU HỒI / QUÁ HẠN",
      value: counters?.overdue_count || 0,
      icon: (
        <AlertCircle className="w-8 h-8 md:w-12 md:h-12 text-rose-50/50 absolute right-2 bottom-2 md:right-4 md:bottom-4" />
      ),
      color: "text-rose-600",
      bgHover: "hover:bg-rose-50/50",
    },
  ];

  if (loading) {
    return (
      <div className="w-full overflow-x-auto pb-4 md:pb-0 hide-scrollbar">
        <div className="flex md:grid md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 w-max md:w-auto">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-[140px] md:w-auto shrink-0 bg-white rounded-2xl border border-slate-100 p-3 md:p-4 h-24 md:h-28 animate-pulse relative"
            >
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-slate-200 rounded w-1/4"></div>
              <div className="absolute right-3 bottom-3 md:right-4 md:bottom-4 w-8 h-8 md:w-10 md:h-10 bg-slate-100 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-4 md:pb-0 mb-2 xl:mb-0 hide-scrollbar">
      <div className="flex md:grid md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 w-max md:w-auto px-1 md:px-0">
        {kpiItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleCardClick(item.id)}
            className={`w-[145px] md:w-auto shrink-0 bg-white rounded-3xl border border-slate-200/70 p-4 md:p-5 h-28 md:h-32 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-sm ${item.bgHover} cursor-pointer group text-left focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1`}
          >
            <div className="relative z-10 flex flex-col h-full justify-between">
              <h3
                className={`text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2 ${item.color}`}
              >
                {item.title}
              </h3>
              <div className="flex items-end justify-between">
                <span
                  className={`text-3xl font-black ${item.value > 0 ? "text-slate-900" : "text-slate-300"}`}
                >
                  {item.value}
                </span>
                <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Xem
                </span>
              </div>
            </div>
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
};
