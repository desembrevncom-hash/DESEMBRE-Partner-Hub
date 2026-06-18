import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface DispatchPreviewCardProps {
  previewData: {
    total_queue_rows: number;
    eligible_ready_rows: number;
    skipped_blocked_rows: number;
  } | null;
  loading: boolean;
}

export function DispatchPreviewCard({ previewData, loading }: DispatchPreviewCardProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          Preview Dispatch Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : previewData ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500">Total Rows</span>
              <span className="text-2xl font-black text-slate-900">{previewData.total_queue_rows}</span>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col gap-1">
              <span className="text-sm font-medium text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Eligible (Ready)
              </span>
              <span className="text-2xl font-black text-emerald-700">{previewData.eligible_ready_rows}</span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex flex-col gap-1">
              <span className="text-sm font-medium text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Skipped/Blocked
              </span>
              <span className="text-2xl font-black text-amber-700">{previewData.skipped_blocked_rows}</span>
            </div>
          </div>
        ) : (
          <div className="text-center p-8 text-slate-400 font-medium">
            No preview loaded. Enter a Batch ID and click Preview.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
