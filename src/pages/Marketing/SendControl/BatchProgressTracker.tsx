import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { M7SendBatch } from '@/types/marketing_m7';
import { UIState } from '@/hooks/marketing/useM7SendControl';
import { Badge } from '@/components/ui/badge';

export function BatchProgressTracker({ batchStatus, uiState }: { batchStatus: M7SendBatch | null, uiState: UIState }) {
  if (!batchStatus) return null;

  const total = batchStatus.total_recipients || 1; // avoid div by 0
  const pct = Math.round((batchStatus.total_simulated_success / total) * 100);

  return (
    <Card className="rounded-[32px] border-none shadow-sm bg-white">
      <CardHeader className="pb-4 flex flex-row justify-between items-center">
        <CardTitle className="text-lg font-black text-slate-900 uppercase tracking-widest">Simulation Progress</CardTitle>
        <Badge variant="outline" className="font-bold">{batchStatus.status.toUpperCase()}</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
            <p className="text-lg font-black text-slate-900">{batchStatus.total_recipients}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Queued</p>
            <p className="text-lg font-black text-amber-600">{batchStatus.total_queued}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Processing</p>
            <p className="text-lg font-black text-blue-600">{batchStatus.total_processing}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Success</p>
            <p className="text-lg font-black text-emerald-600">{batchStatus.total_simulated_success}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
