import React, { useMemo } from "react";
import {
  Clock,
  Flame,
  Calendar,
  AlertCircle,
  ArrowRight,
  Play,
  FileText,
  PhoneForwarded,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPriorityScore, getStaleSignals } from "@/lib/operationalRules";
import { getCustomerConversationState } from "@/lib/customerConversationState";

interface FocusQueueBarProps {
  customers: any[];
  onStartQueue: (customerId: string) => void;
}

export function FocusQueueBar({ customers, onStartQueue }: FocusQueueBarProps) {
  const queueStats = useMemo(() => {
    let todaysCalls = 0;
    let followUps = 0;
    let hotLeads = 0;
    let quotes = 0;
    let recovery = 0;

    customers.forEach((c) => {
      const state = getCustomerConversationState(c);
      const stage = c.lifecycle_stage || "";
      const staleSignals = getStaleSignals(c);

      if (state.urgency === "today") {
        todaysCalls++;
      } else if (state.temperature === "WARM" && state.urgency !== "overdue") {
        followUps++;
      }

      if (state.temperature === "HOT") {
        hotLeads++;
      }

      if (stage.includes("quote") || stage.includes("proposal") || stage.includes("negotiation")) {
        quotes++;
      }

      if (state.urgency === "overdue" || staleSignals.length > 0) {
        recovery++;
      }
    });

    return { todaysCalls, followUps, hotLeads, quotes, recovery };
  }, [customers]);

  const handleStartQueue = () => {
    // Sort by new priority score
    const sorted = [...customers].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

    if (sorted.length > 0) {
      onStartQueue(sorted[0].id);
    }
  };

  const totalActionable =
    queueStats.todaysCalls +
    queueStats.followUps +
    queueStats.hotLeads +
    queueStats.quotes +
    queueStats.recovery;
  if (totalActionable === 0) return null;

  return (
    <div className="bg-white text-slate-800 border border-slate-200 rounded-xl p-2 flex flex-col md:flex-row items-center justify-between shadow-sm mb-4 gap-3">
      <div className="flex items-center gap-3 px-2 w-full md:w-auto overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
            <Play className="w-3 h-3 text-indigo-600 fill-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 leading-tight">
              Operational Queue
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-tight">
              {totalActionable} nhiệm vụ
            </p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-100 hidden md:block shrink-0" />

        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${queueStats.todaysCalls > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-400 bg-slate-50 border-slate-100"}`}
          >
            <PhoneForwarded className="w-3 h-3" />
            <span className="text-[10px] font-bold">Gọi hôm nay ({queueStats.todaysCalls})</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${queueStats.hotLeads > 0 ? "text-orange-700 bg-orange-50 border-orange-200" : "text-slate-400 bg-slate-50 border-slate-100"}`}
          >
            <Flame className="w-3 h-3" />
            <span className="text-[10px] font-bold">HOT ({queueStats.hotLeads})</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${queueStats.quotes > 0 ? "text-blue-700 bg-blue-50 border-blue-200" : "text-slate-400 bg-slate-50 border-slate-100"}`}
          >
            <FileText className="w-3 h-3" />
            <span className="text-[10px] font-bold">Báo giá ({queueStats.quotes})</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${queueStats.followUps > 0 ? "text-indigo-700 bg-indigo-50 border-indigo-200" : "text-slate-400 bg-slate-50 border-slate-100"}`}
          >
            <Calendar className="w-3 h-3" />
            <span className="text-[10px] font-bold">Follow-ups ({queueStats.followUps})</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${queueStats.recovery > 0 ? "text-rose-700 bg-rose-50 border-rose-200" : "text-slate-400 bg-slate-50 border-slate-100"}`}
          >
            <AlertCircle className="w-3 h-3" />
            <span className="text-[10px] font-bold">Recovery ({queueStats.recovery})</span>
          </div>
        </div>
      </div>

      <Button
        onClick={handleStartQueue}
        size="sm"
        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold px-4 shadow-sm w-full md:w-auto shrink-0 h-8 text-[11px]"
      >
        Start Focus
        <ArrowRight className="w-3 h-3 ml-1.5" />
      </Button>
    </div>
  );
}
