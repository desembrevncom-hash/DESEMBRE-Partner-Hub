import React from "react";
import { MessageCircle, Clock, FileText, Phone, ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SaleCustomerInsightsProps {
  customer: any;
  interactionSummary: any;
  onQuickAction: (action: "note" | "task" | "followup") => void;
  onCreateOrder?: () => void;
}

export const SaleCustomerInsights: React.FC<SaleCustomerInsightsProps> = ({ 
  customer, 
  interactionSummary,
  onQuickAction,
  onCreateOrder
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
            <MessageCircle className="w-3 h-3" /> Kênh ưu tiên
          </div>
          <div className="text-sm font-black text-slate-700 capitalize">
            {interactionSummary?.most_used_platform || "Chưa có"}
          </div>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Tương tác cuối
          </div>
          <div className="text-sm font-black text-slate-700">
            {customer.last_contacted_at ? new Date(customer.last_contacted_at).toLocaleDateString("vi-VN") : "Chưa có"}
          </div>
        </div>
        <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
            <FileText className="w-3 h-3" /> Mẫu tin nhắn gần nhất
          </div>
          <div className="text-xs font-medium text-slate-600 italic">
            Chưa sử dụng mẫu nào
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onQuickAction("note")} className="flex-1 text-xs" variant="outline">
          Ghi chú nhanh
        </Button>
        <Button 
          onClick={onCreateOrder} 
          className="flex-1 text-xs border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" 
          variant="outline"
        >
          <Package className="w-3.5 h-3.5 mr-1" />
          Tạo đơn mới
        </Button>
        <Button onClick={() => onQuickAction("task")} className="flex-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
          Task
        </Button>
      </div>
    </div>
  );
};
