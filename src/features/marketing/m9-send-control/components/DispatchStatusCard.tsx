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
        <CardTitle className="text-lg font-bold text-slate-800">Trạng thái Kịch bản</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 min-h-[160px] flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-semibold">Đang tải trạng thái...</p>
          </div>
        ) : statusData ? (
          <div className="space-y-4 max-w-md mx-auto w-full">
            <div className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50">
              <span className="text-sm font-bold text-slate-600">Tổng số</span>
              <span className="text-lg font-black text-slate-900">{statusData.total}</span>
            </div>
            <div className="h-px bg-slate-100 w-full" />
            <div className="flex justify-between items-center p-3 rounded-xl hover:bg-emerald-50">
              <span className="text-sm font-bold text-emerald-600">Sẵn sàng / Đang gửi / Đã gửi</span>
              <span className="text-lg font-black text-emerald-700">{statusData.ready}</span>
            </div>
            <div className="h-px bg-slate-100 w-full" />
            <div className="flex justify-between items-center p-3 rounded-xl hover:bg-amber-50">
              <span className="text-sm font-bold text-amber-600">Bỏ qua / Bị chặn / Đã hủy</span>
              <span className="text-lg font-black text-amber-700">{statusData.skipped}</span>
            </div>
          </div>
        ) : (
          <p className="text-center text-slate-400 font-medium">Chưa có trạng thái.</p>
        )}
      </CardContent>
    </Card>
  );
}
