import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { Loader2, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/marketing/unsubscribe")({
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const search: any = Route.useSearch();
  const token = search.token;
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!token) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-lg rounded-[24px]">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto" />
            <h1 className="text-xl font-black text-slate-900">Lỗi xác thực</h1>
            <p className="text-slate-500 font-medium text-sm">
              Không tìm thấy thông tin xác thực. Liên kết này không hợp lệ hoặc đã bị thiếu dữ liệu.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUnsubscribe = async () => {
    try {
      setStatus("loading");
      const res = await fetch("https://xhfqjupiidexvlltstal.supabase.co/functions/v1/marketing-unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data.error || "Đã có lỗi xảy ra khi xử lý yêu cầu.");
      }
      
      setStatus("success");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Không thể kết nối đến máy chủ.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans">
      <Card className="max-w-md w-full border-none shadow-xl rounded-[24px] bg-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500" />
        <CardContent className="p-8 text-center space-y-6 mt-2">
          
          {status === "idle" && (
            <>
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-slate-100">
                <ShieldAlert className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 mb-2">Hủy đăng ký nhận Email</h1>
                <p className="text-slate-500 font-medium text-sm">
                  Bạn có chắc chắn muốn ngừng nhận email marketing? Bấm nút bên dưới để xác nhận.
                </p>
              </div>
              <Button 
                onClick={handleUnsubscribe}
                className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-200"
              >
                Xác nhận Hủy Đăng Ký
              </Button>
            </>
          )}

          {status === "loading" && (
            <div className="py-8">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
              <p className="text-slate-500 font-medium text-sm animate-pulse">Đang xử lý yêu cầu...</p>
            </div>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-100">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 mb-2">Đã hủy đăng ký thành công</h1>
                <p className="text-slate-500 font-medium text-sm">
                  Bạn đã được xóa khỏi danh sách nhận email quảng cáo. Cảm ơn bạn đã phản hồi!
                </p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-rose-100">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 mb-2">Lỗi xử lý</h1>
                <p className="text-rose-600 font-medium text-sm">
                  {errorMessage}
                </p>
              </div>
              <Button 
                onClick={() => setStatus("idle")}
                variant="outline"
                className="w-full h-12 font-bold rounded-xl text-sm mt-2 border-slate-200"
              >
                Thử lại
              </Button>
            </>
          )}
          
        </CardContent>
      </Card>
    </div>
  );
}
