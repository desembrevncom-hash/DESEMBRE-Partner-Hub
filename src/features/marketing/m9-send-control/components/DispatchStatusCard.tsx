import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface DispatchStatusCardProps {
  statusData: {
    total: number;
    ready: number;
    skipped: number;
  } | null;
  loading: boolean;
}

export function DispatchStatusCard({ statusData, loading }: DispatchStatusCardProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
        <CardTitle className="text-lg font-bold">View Dispatch Status</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : statusData ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Total</span>
              <span className="font-bold text-slate-900">{statusData.total}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Ready</span>
              <span className="font-bold text-emerald-600">{statusData.ready}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600 font-medium">Skipped/Blocked/Cancelled</span>
              <span className="font-bold text-amber-600">{statusData.skipped}</span>
            </div>
          </div>
        ) : (
          <div className="text-center p-8 text-slate-400 font-medium">
            No status available.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
