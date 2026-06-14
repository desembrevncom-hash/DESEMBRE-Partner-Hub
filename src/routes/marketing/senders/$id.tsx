import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Save, Server, Activity, Clock, ShieldAlert } from "lucide-react";
import { SenderSafetyNotice } from "@/components/marketing/senders/SenderSafetyNotice";
import { SenderReadinessBadge } from "@/components/marketing/senders/SenderReadinessBadge";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/marketing/senders/$id")({
  component: SenderReadinessDetail,
});

function SenderReadinessDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<string>("needs_review");
  const [note, setNote] = useState<string>("");

  const { data: sender, isLoading, error } = useQuery({
    queryKey: ["v_sender_accounts_readiness_safe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_sender_accounts_readiness_safe")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Sender account not found or access denied");
      return data;
    },
  });

  useEffect(() => {
    if (sender) {
      setStatus(sender.readiness_status || "needs_review");
      setNote(sender.readiness_note || "");
    }
  }, [sender]);

  const updateMutation = useMutation({
    mutationFn: async (vars: { p_account_id: string; p_readiness_status: string; p_readiness_note: string }) => {
      // Safe RPC strictly restricted to readiness fields and Admin role
      const { error } = await supabase.rpc("update_sender_account_readiness", vars);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cập nhật metadata thành công");
      queryClient.invalidateQueries({ queryKey: ["v_sender_accounts_readiness_safe"] });
    },
    onError: (err: any) => {
      toast.error("Lỗi cập nhật", {
        description: err.message,
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      p_account_id: id,
      p_readiness_status: status,
      p_readiness_note: note,
    });
  };

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <SenderSafetyNotice />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center text-red-600 flex flex-col items-center">
            <ShieldAlert className="h-10 w-10 mb-2 opacity-50" />
            <p className="font-semibold">Truy cập bị từ chối</p>
            <p className="text-sm mt-1">{error.message}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.history.back()}>
              Quay lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !sender) {
    return <div className="p-12 text-center text-slate-500">Đang tải metadata...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100">
        <div className="container mx-auto px-6 py-8 max-w-5xl">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/marketing/senders">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100 transition-colors">
                <ChevronLeft className="h-5 w-5 text-slate-600" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Chi tiết Readiness</h1>
                <SenderReadinessBadge status={sender.readiness_status} />
              </div>
              <p className="text-sm font-medium text-slate-500 mt-1">Cấu hình tham số và trạng thái của {sender.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 mt-8 max-w-5xl space-y-8">
        <SenderSafetyNotice />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* READ-ONLY METADATA */}
          <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 pb-4 border-b border-slate-50 bg-slate-50/30">
              <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <Server className="h-4 w-4" />
                </div>
                Siêu dữ liệu hệ thống
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-5">
              <div className="flex items-center justify-between text-sm pb-4 border-b border-slate-50">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Tên người gửi:</div>
                <div className="text-slate-900 font-bold">{sender.name || "—"}</div>
              </div>
              <div className="flex items-center justify-between text-sm pb-4 border-b border-slate-50">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Nhà cung cấp:</div>
                <div className="text-slate-900 font-semibold capitalize bg-slate-100 px-3 py-1 rounded-lg text-xs">{sender.provider || "—"}</div>
              </div>
              <div className="flex items-center justify-between text-sm pb-4 border-b border-slate-50">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Kênh liên lạc:</div>
                <div className="text-indigo-600 font-bold capitalize bg-indigo-50 px-3 py-1 rounded-lg text-xs">{sender.channel?.replace("_", " ") || "—"}</div>
              </div>
              <div className="flex items-center justify-between text-sm pb-4 border-b border-slate-50">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Email gửi:</div>
                <div className="text-slate-900 font-medium">{sender.sender_email || "—"}</div>
              </div>
              <div className="flex items-center justify-between text-sm pb-4 border-b border-slate-50">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Tên hiển thị:</div>
                <div className="text-slate-900 font-medium">{sender.sender_name || "—"}</div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Trạng thái cũ:</div>
                <div className="text-slate-500 font-semibold">
                  <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs">{sender.legacy_status}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* HEALTH STATUS */}
          <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 pb-4 border-b border-slate-50 bg-slate-50/30">
              <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <Activity className="h-4 w-4" />
                </div>
                Kết quả kiểm tra
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tình trạng kết nối API:</p>
                <span className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 ${
                  sender.health_status === "healthy" ? "bg-emerald-100 text-emerald-700" :
                  sender.health_status === "error" ? "bg-red-100 text-red-700" :
                  "bg-slate-100 text-slate-700"
                }`}>
                  <div className={`w-2 h-2 rounded-full ${sender.health_status === "healthy" ? "bg-emerald-500 animate-pulse" : sender.health_status === "error" ? "bg-red-500" : "bg-slate-400"}`} />
                  {sender.health_status || "Chưa rõ"}
                </span>
              </div>
              <div className="pt-6 border-t border-slate-50">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Kiểm tra lần cuối lúc:</p>
                <div className="text-slate-900 font-semibold flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-400" /> 
                  {sender.last_checked_at ? new Date(sender.last_checked_at).toLocaleString("vi-VN") : "—"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* EDITABLE READINESS */}
          <Card className="rounded-[32px] border-none shadow-lg shadow-indigo-100/50 overflow-hidden bg-white md:col-span-2 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            <CardHeader className="p-8 pb-4 border-b border-slate-50 bg-gradient-to-br from-indigo-50/50 to-white">
              <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                Cấu hình Readiness <Badge variant="outline" className="ml-2 text-[9px] bg-white border-indigo-200 text-indigo-600 uppercase">Admin Only</Badge>
              </CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500 mt-2">
                Cập nhật trạng thái Readiness thủ công. Trạng thái này chỉ dùng để quyết định mức độ sẵn sàng được hiển thị trên Dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <Label htmlFor="status" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Trạng thái readiness</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status" className="w-full md:w-[400px] h-12 rounded-xl bg-slate-50 border-slate-200 font-semibold text-sm">
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="not_configured" className="font-medium text-sm py-2.5">Chưa cấu hình (not_configured)</SelectItem>
                    <SelectItem value="needs_review" className="font-medium text-sm py-2.5 text-amber-700">Cần kiểm tra (needs_review)</SelectItem>
                    <SelectItem value="ready" className="font-medium text-sm py-2.5 text-emerald-700">Sẵn sàng (ready)</SelectItem>
                    <SelectItem value="disabled" className="font-medium text-sm py-2.5 text-slate-400">Đã vô hiệu (disabled)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="note" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ghi chú readiness</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Đã kiểm tra webhook nhưng còn thiếu quyền API..."
                  className="min-h-[120px] rounded-xl bg-slate-50 border-slate-200 text-sm focus:bg-white transition-colors"
                />
              </div>
              
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" />
                  Sửa đổi: {sender.readiness_last_reviewed_at ? new Date(sender.readiness_last_reviewed_at).toLocaleString("vi-VN") : "Chưa từng"}
                </div>
                <Button 
                  onClick={handleSave} 
                  disabled={updateMutation.isPending}
                  className="rounded-xl h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-200 transition-all hover:scale-105"
                >
                  {updateMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang lưu...
                    </div>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Lưu cấu hình Readiness
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
