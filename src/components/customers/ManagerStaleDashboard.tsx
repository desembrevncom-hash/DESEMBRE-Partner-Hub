import React, { useMemo } from "react";
import { ShieldAlert, AlertTriangle, Ghost, Clock, Flame } from "lucide-react";
import { getStaleSignals, StaleSignal } from "@/lib/operationalRules";

interface ManagerStaleDashboardProps {
  customers: any[];
}

export function ManagerStaleDashboard({ customers }: ManagerStaleDashboardProps) {
  const stats = useMemo(() => {
    let lead_dead = 0;
    let forgotten = 0;
    let quote_ignored = 0;
    let no_touchpoint = 0;

    customers.forEach((c) => {
      const signals = getStaleSignals(c);
      signals.forEach((s) => {
        if (s.signal === "lead_dead") lead_dead++;
        if (s.signal === "forgotten") forgotten++;
        if (s.signal === "quote_ignored") quote_ignored++;
        if (s.signal === "no_touchpoint") no_touchpoint++;
      });
    });

    return { lead_dead, forgotten, quote_ignored, no_touchpoint };
  }, [customers]);

  const totalStale = stats.lead_dead + stats.forgotten + stats.quote_ignored + stats.no_touchpoint;
  if (totalStale === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between shadow-lg mb-6 gap-4">
      <div className="flex items-center gap-4 px-2 w-full md:w-auto overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-rose-300">
              Stale Signals
            </p>
            <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">
              {totalStale} rủi ro
            </p>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-800 hidden md:block shrink-0" />

        <div className="flex items-center gap-3 shrink-0">
          {stats.lead_dead > 0 && (
            <div className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
              <Ghost className="w-4 h-4" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold opacity-70">Lead Chết</span>
                <span className="text-[11px] font-black">{stats.lead_dead}</span>
              </div>
            </div>
          )}
          {stats.quote_ignored > 0 && (
            <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold opacity-70">Báo giá quên</span>
                <span className="text-[11px] font-black">{stats.quote_ignored}</span>
              </div>
            </div>
          )}
          {stats.forgotten > 0 && (
            <div className="flex items-center gap-1.5 text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
              <Clock className="w-4 h-4" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold opacity-70">Bị lãng quên</span>
                <span className="text-[11px] font-black">{stats.forgotten}</span>
              </div>
            </div>
          )}
          {stats.no_touchpoint > 0 && (
            <div className="flex items-center gap-1.5 text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <ShieldAlert className="w-4 h-4 opacity-50" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold opacity-70">Không có TP</span>
                <span className="text-[11px] font-black">{stats.no_touchpoint}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-[10px] text-slate-400 font-medium px-4 shrink-0 text-center md:text-right hidden xl:block">
        Tự động phát hiện các luồng <br />
        khách hàng có nguy cơ thất thoát.
      </div>
    </div>
  );
}
