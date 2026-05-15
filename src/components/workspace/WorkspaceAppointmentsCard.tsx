import React from "react";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface WorkspaceAppointmentsCardProps {
  appointments: any[];
  emptyMessage?: string;
}

export const WorkspaceAppointmentsCard: React.FC<WorkspaceAppointmentsCardProps> = ({ appointments, emptyMessage = "Chưa có lịch hẹn sắp tới." }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="bg-indigo-600 p-4 text-white">
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Lịch hẹn / Follow-up
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[300px] divide-y divide-slate-50">
        {appointments.length > 0 ? (
          appointments.map(app => (
            <div key={app.id} className="p-4 hover:bg-indigo-50/30 transition-colors group">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-600 shrink-0">
                  <span className="text-[10px] font-black leading-none">{format(new Date(app.start_time), "dd")}</span>
                  <span className="text-[8px] font-bold uppercase mt-0.5">{format(new Date(app.start_time), "MMM", { locale: vi })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-bold text-slate-800 line-clamp-1">{app.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {format(new Date(app.start_time), "HH:mm")}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 truncate">
                      <MapPin className="w-2.5 h-2.5" /> {app.location || "Online / Call"}
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 shrink-0 mt-1" />
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center">
            <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
