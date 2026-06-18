import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, List } from "lucide-react";

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
        <CardTitle className="text-lg font-bold text-slate-800">Xem trước Kịch bản Gửi</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 min-h-[160px] flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-semibold">Đang tải dữ liệu xem trước...</p>
          </div>
        ) : previewData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-center items-center text-center">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <List className="w-4 h-4" /> Tổng số khách
              </span>
              <span className="text-4xl font-black text-slate-900">{previewData.total_queue_rows}</span>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex flex-col justify-center items-center text-center">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
                <CheckCircle2 className="w-4 h-4" /> Đủ điều kiện (Sẵn sàng)
              </span>
              <span className="text-4xl font-black text-emerald-700">{previewData.eligible_ready_rows}</span>
            </div>
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex flex-col justify-center items-center text-center">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
                <AlertTriangle className="w-4 h-4" /> Bỏ qua/Bị chặn
              </span>
              <span className="text-4xl font-black text-amber-800">{previewData.skipped_blocked_rows}</span>
            </div>
          </div>
        ) : (
          <p className="text-center text-slate-400 font-medium">Chưa có dữ liệu. Vui lòng nhập Batch ID và ấn Xem trước.</p>
        )}
      </CardContent>
    </Card>
  );
}
