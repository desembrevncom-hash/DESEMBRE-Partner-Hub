import React from "react";
import { Phone, Clock, UserCheck, FileText, Package, AlertCircle } from "lucide-react";
import { WorkspaceCounters } from "@/types/workspace";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  counters?: WorkspaceCounters;
  loading: boolean;
}

export const WorkspaceKpiCards: React.FC<Props> = ({ counters, loading }) => {
  const navigate = useNavigate();

  const handleCardClick = (type: string) => {
    // Navigate with query params for filtering (simplified for P1A)
    switch (type) {
      case "lead":
        navigate({ to: "/customers", search: { filter: "leads_to_call" } as any });
        break;
      case "followup":
        navigate({ to: "/customers", search: { filter: "follow_up_today" } as any });
        break;
      case "checkin":
        navigate({ to: "/customers", search: { filter: "checkin_today" } as any });
        break;
      case "quotation":
        navigate({ to: "/customers", search: { filter: "quotation_pending" } as any });
        break;
      case "draft_order":
        navigate({ to: "/orders", search: { filter: "draft" } as any });
        break;
      case "overdue":
        navigate({ to: "/customers", search: { filter: "overdue" } as any });
        break;
    }
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-100 p-4 h-28 animate-pulse"
          >
            <div className="h-3 bg-slate-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-slate-200 rounded w-1/4"></div>
            <div className="absolute right-4 bottom-4 w-10 h-10 bg-slate-100 rounded-full"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {kpiItems.map((item) => (
        <div
          key={item.id}
          onClick={() => handleCardClick(item.id)}
          className={`bg-white rounded-2xl border border-slate-100 p-4 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50 ${item.bgHover} cursor-pointer group`}
        >
          <div className="relative z-10 flex flex-col h-full justify-between">
            <h3 className={`text-[10px] font-black tracking-wider uppercase mb-2 ${item.color}`}>
              {item.title}
            </h3>
            <div className="flex items-end justify-between">
              <span
                className={`text-4xl font-black tracking-tighter ${item.value > 0 ? "text-slate-800" : "text-slate-300"}`}
              >
                {item.value}
              </span>
              <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Xem
              </span>
            </div>
          </div>
          {item.icon}
        </div>
      ))}
    </div>
  );
};
