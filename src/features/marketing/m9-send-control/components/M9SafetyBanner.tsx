import { AlertTriangle } from "lucide-react";

export function M9SafetyBanner() {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-4 shadow-sm">
      <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
      <div>
        <h3 className="text-red-800 font-bold uppercase tracking-wide text-sm">CẢNH BÁO AN TOÀN (CRITICAL SAFETY NOTICE)</h3>
        <p className="text-red-700 text-sm mt-1 font-medium">
          Giao diện này chỉ dùng để chuẩn bị kịch bản gửi nội bộ. Hệ thống <span className="font-bold underline">KHÔNG</span> gửi tin nhắn thật sự. Không có dịch vụ gửi tin ngoài (Provider) nào được kết nối ở giai đoạn này.
        </p>
      </div>
    </div>
  );
}
