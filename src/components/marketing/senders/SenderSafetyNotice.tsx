import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SenderSafetyNotice() {
  return (
    <Alert className="bg-amber-50 border-amber-200 text-amber-800 mb-6">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="font-semibold text-amber-800">Cảnh báo tính năng</AlertTitle>
      <AlertDescription className="text-amber-700/90 mt-1">
        Màn hình này chỉ hiển thị trạng thái sẵn sàng và metadata. Hệ thống chưa kết nối API, chưa đồng bộ provider và <strong className="font-semibold">chưa gửi tin tự động</strong>.
      </AlertDescription>
    </Alert>
  );
}
