import React from "react";
import { CalendarClock, MapPin } from "lucide-react";
import { WorkspaceTimelineEvent } from "@/types/workspace";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";
import { CRMLoadingState } from "@/components/crm/CRMLoadingState";

interface Props {
  events: WorkspaceTimelineEvent[];
  loading: boolean;
  onOpenCustomer: (id: string) => void;
}

export const WorkspaceTimeline: React.FC<Props> = ({ events, loading, onOpenCustomer }) => {
  if (loading) {
    return (
      <CRMCard className="h-full">
        <CRMLoadingState type="list" rows={2} />
      </CRMCard>
    );
  }

  return (
    <CRMCard className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-5 h-5 text-indigo-600" />
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Schedule</h3>
      </div>

      {events.length === 0 ? (
        <CRMEmptyState title="Trống lịch, hãy tập trung xử lý công việc!" />
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
    </CRMCard>
  );
};
