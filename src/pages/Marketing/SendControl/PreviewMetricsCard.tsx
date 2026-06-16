import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { M7PreviewResult } from '@/types/marketing_m7';
import { Users, AlertCircle } from 'lucide-react';

export function PreviewMetricsCard({ previewResult }: { previewResult: M7PreviewResult }) {
  return (
    <Card className="rounded-[32px] border-none shadow-sm bg-white">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-black text-slate-900 uppercase tracking-widest">Preview Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-6">
          <div className="flex-1 bg-indigo-50 p-6 rounded-2xl">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Users className="w-3 h-3" /> Valid Recipients
            </p>
            <p className="text-3xl font-black text-indigo-600">{previewResult.total_valid}</p>
          </div>
          <div className="flex-1 bg-rose-50 p-6 rounded-2xl">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> Skipped Recipients
            </p>
            <p className="text-3xl font-black text-rose-600">{previewResult.total_skipped}</p>
          </div>
        </div>

        {Object.keys(previewResult.skip_reasons_summary || {}).length > 0 && (
          <div className="bg-slate-50 p-4 rounded-2xl">
            <p className="text-xs font-bold text-slate-500 uppercase mb-3">Skip Reasons</p>
            <div className="space-y-2">
              {Object.entries(previewResult.skip_reasons_summary).map(([reason, count]) => (
                <div key={reason} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-600">{reason}</span>
                  <span className="text-sm font-black text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
