import React from "react";
import { CalendarClock, MapPin } from "lucide-react";
import { WorkspaceTimelineEvent } from "@/types/workspace";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  events: WorkspaceTimelineEvent[];
  loading: boolean;
  onOpenCustomer: (id: string) => void;
}

export const WorkspaceTimeline: React.FC<Props> = ({ events, loading, onOpenCustomer }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs h-full animate-pulse">
        <div className="h-6 w-1/3 bg-slate-200 rounded mb-6"></div>
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-12 h-4 bg-slate-200 rounded mt-1"></div>
              <div className="flex-1 h-16 bg-slate-100 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <CalendarClock className="w-5 h-5 text-purple-500" />
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">
          Lịch trình hôm nay
        </h3>
      </div>

      {events.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <span className="text-3xl mb-2">☕</span>
          <p className="text-xs font-bold text-slate-600">
            Trống lịch, hãy tập trung xử lý công việc!
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 pr-2 -mr-2 no-scrollbar">
          <div className="relative pb-2">
            {/* Vertical Line */}
            <div className="absolute left-[29px] top-2 bottom-2 w-0.5 bg-slate-100"></div>

            <div className="space-y-4 relative z-10">
              {events.map((event) => {
                const eventDate = new Date(event.starts_at);
                const timeStr = format(eventDate, "HH:mm");

                let colorClasses = "bg-purple-50 border-purple-200 text-purple-700";
                let dotClass = "bg-purple-400 ring-purple-100";

                if (event.visibility === "company") {
                  colorClasses = "bg-blue-50 border-blue-200 text-blue-700";
                  dotClass = "bg-blue-400 ring-blue-100";
                }

                return (
                  <div
                    key={event.id}
                    className="flex gap-4 group cursor-pointer"
                    onClick={() => event.customer_id && onOpenCustomer(event.customer_id)}
                  >
                    {/* Time & Dot */}
                    <div className="flex flex-col items-center pt-2">
                      <span className="text-[10px] font-black text-slate-400 mb-1">{timeStr}</span>
                      <div className={`w-2.5 h-2.5 rounded-full ring-4 ${dotClass}`}></div>
                    </div>

                    {/* Card */}
                    <div
                      className={`flex-1 p-3 rounded-2xl border transition-all hover:shadow-md ${colorClasses}`}
                    >
                      <h4 className="text-xs font-bold mb-1">{event.title}</h4>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium opacity-80 capitalize">
                          {event.event_type.replace(/_/g, " ")}
                        </span>
                        {event.visibility === "company" && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[8px] font-black uppercase">
                            Chung
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
