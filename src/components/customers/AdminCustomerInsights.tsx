import React from "react";
import { UserCheck, ShieldAlert, Clock, AlertTriangle, Users, PhoneCall, UserMinus, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdminCustomerInsightsProps {
  customer: any;
  onAssignSale?: () => void;
  onAssignTele?: () => void;
  onRevoke?: () => void;
  onAdminNote?: () => void;
}

export const AdminCustomerInsights: React.FC<AdminCustomerInsightsProps> = ({ 
  customer,
  onAssignSale,
  onAssignTele,
  onRevoke,
  onAdminNote
}) => {
  const inactiveDays = Math.floor((new Date().getTime() - new Date(customer.last_contacted_at || customer.created_at).getTime()) / (1000 * 3600 * 24));
  
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-indigo-500" />
          Admin Ops Panel
        </div>
        <Badge variant="outline" className="text-[9px] uppercase font-bold bg-white">
          {customer.owner_sale_id ? "Assigned" : "Unassigned"}
        </Badge>
      </div>
      
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
            <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">SLA Status</div>
            <div className={`text-xs font-black ${inactiveDays > 7 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {inactiveDays > 7 ? "Vi phạm" : "An toàn"}
            </div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
            <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Inactive</div>
            <div className="text-xs font-black text-slate-800">{inactiveDays} ngày</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
            <div className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Action</div>
            <div className="text-[10px] font-bold text-amber-600 leading-tight">Push Sale</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={onAssignSale} size="sm" variant="outline" className="text-xs px-2 h-8">
              <Users className="w-3 h-3 mr-1 shrink-0" /> <span className="truncate">Đổi Sale</span>
            </Button>
            <Button onClick={onAssignTele} size="sm" variant="outline" className="text-xs px-2 h-8">
              <PhoneCall className="w-3 h-3 mr-1 shrink-0" /> <span className="truncate">Đổi Tele</span>
            </Button>
            <Button onClick={onRevoke} size="sm" variant="outline" className="text-xs px-2 h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200">
              <UserMinus className="w-3 h-3 mr-1 shrink-0" /> <span className="truncate">Thu hồi</span>
            </Button>
          </div>
          <Button onClick={onAdminNote} size="sm" className="w-full text-xs h-8 bg-slate-800 text-white hover:bg-slate-900">
            <Edit className="w-3 h-3 mr-1" /> Ghi chú Quản lý
          </Button>
        </div>
      </div>
    </div>
  );
};
