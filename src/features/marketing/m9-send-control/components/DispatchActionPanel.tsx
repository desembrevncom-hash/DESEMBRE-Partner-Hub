import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, PlayCircle, RefreshCw, XCircle } from "lucide-react";

interface DispatchActionPanelProps {
  batchId: string | null;
  isProcessing: boolean;
  onPreview: () => void;
  onCreate: () => void;
  onRefreshStatus: () => void;
  onCancel?: () => void;
}

export function DispatchActionPanel({
  batchId,
  isProcessing,
  onPreview,
  onCreate,
  onRefreshStatus,
  onCancel,
}: DispatchActionPanelProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
        <CardTitle className="text-lg font-bold text-slate-800">Thao tác</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <Button
          variant="secondary"
          className="w-full justify-start gap-3 rounded-xl h-11 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
          disabled={!batchId || isProcessing}
          onClick={onPreview}
        >
          <Eye className="w-4 h-4" /> Xem trước Kịch bản
        </Button>

        <Button
          className="w-full justify-start gap-3 rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={!batchId || isProcessing}
          onClick={onCreate}
        >
          <PlayCircle className="w-4 h-4" /> Tạo Kịch bản Gửi
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-3 rounded-xl h-11"
          disabled={!batchId || isProcessing}
          onClick={onRefreshStatus}
        >
          <RefreshCw className="w-4 h-4" /> Làm mới Trạng thái
        </Button>

        {onCancel && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl h-11 text-red-600 hover:bg-red-50 hover:text-red-700 mt-4"
            disabled={!batchId || isProcessing}
            onClick={onCancel}
          >
            <XCircle className="w-4 h-4" /> Hủy bỏ Kịch bản
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
