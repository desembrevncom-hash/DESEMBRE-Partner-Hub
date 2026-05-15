import React from "react";
import { Users, Phone, ShieldCheck, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getLifecycleLabel } from "@/lib/customerOwnership";

interface WorkspaceCustomersCardProps {
  title: string;
  customers: any[];
  icon: React.ReactNode;
  color: string;
  emptyMessage?: string;
}

export const WorkspaceCustomersCard: React.FC<WorkspaceCustomersCardProps> = ({ title, customers, icon, color, emptyMessage = "Chưa có khách cần chăm hôm nay." }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full">
      <div className={`${color} p-4 text-white flex items-center justify-between`}>
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          {icon} {title}
        </h3>
        <Badge variant="secondary" className="bg-white/20 text-white border-none text-[10px]">
          {customers.length}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-slate-50">
        {customers.length > 0 ? (
          customers.map(c => (
            <div key={c.id} className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-[13px] font-bold text-slate-800 line-clamp-1 group-hover:text-primary transition-colors">
                    {c.facility_name}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">{c.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold">
                    {getLifecycleLabel(c.lifecycle_stage)}
                  </Badge>
                  <span className="text-[10px] text-slate-400 font-bold">{c.phone}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
