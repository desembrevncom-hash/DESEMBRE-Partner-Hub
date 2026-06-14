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
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/marketing/senders/$id")({
  component: SenderReadinessDetail,
});

function SenderReadinessDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { toast } = useToast();
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
      toast({ title: "Cập nhật metadata thành công" });
      queryClient.invalidateQueries({ queryKey: ["v_sender_accounts_readiness_safe"] });
    },
    onError: (err: any) => {
      toast({
        title: "Lỗi cập nhật",
        description: err.message,
        variant: "destructive",
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
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/marketing/senders">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Chi tiết Readiness</h1>
        </div>
        <SenderReadinessBadge status={sender.readiness_status} />
      </div>

      <SenderSafetyNotice />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* READ-ONLY METADATA */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50 border-b pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-500" />
              Siêu dữ liệu hệ thống (Read-only)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm border-b pb-2 border-slate-100">
              <div className="text-slate-500 font-medium col-span-1">Tên người gửi:</div>
              <div className="text-slate-900 col-span-2">{sender.name || "—"}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm border-b pb-2 border-slate-100">
              <div className="text-slate-500 font-medium col-span-1">Nhà cung cấp:</div>
              <div className="text-slate-900 col-span-2 capitalize">{sender.provider || "—"}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm border-b pb-2 border-slate-100">
              <div className="text-slate-500 font-medium col-span-1">Kênh:</div>
              <div className="text-slate-900 col-span-2 capitalize">{sender.channel?.replace("_", " ") || "—"}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm border-b pb-2 border-slate-100">
              <div className="text-slate-500 font-medium col-span-1">Email gửi:</div>
              <div className="text-slate-900 col-span-2">{sender.sender_email || "—"}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm border-b pb-2 border-slate-100">
              <div className="text-slate-500 font-medium col-span-1">Tên hiển thị:</div>
              <div className="text-slate-900 col-span-2">{sender.sender_name || "—"}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-slate-500 font-medium col-span-1">Trạng thái cũ:</div>
              <div className="text-slate-900 col-span-2">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{sender.legacy_status}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* HEALTH STATUS */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50 border-b pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" />
              Kết quả kiểm tra gần nhất
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm border-b pb-2 border-slate-100">
              <div className="text-slate-500 font-medium col-span-1">Health:</div>
              <div className="col-span-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  sender.health_status === "healthy" ? "bg-emerald-100 text-emerald-700" :
                  sender.health_status === "error" ? "bg-red-100 text-red-700" :
                  "bg-slate-100 text-slate-700"
                }`}>
                  {sender.health_status || "Chưa rõ"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-slate-500 font-medium col-span-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Kiểm tra lúc:
              </div>
              <div className="text-slate-900 col-span-2">
                {sender.last_checked_at ? new Date(sender.last_checked_at).toLocaleString("vi-VN") : "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* EDITABLE READINESS */}
        <Card className="shadow-sm md:col-span-2">
          <CardHeader className="bg-slate-50 border-b pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              Cấu hình Readiness (Admin Only)
            </CardTitle>
            <CardDescription>
              Cập nhật trạng thái Readiness thủ công. Trạng thái này chỉ dùng để hiển thị mức độ sẵn sàng trên giao diện.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="status">Trạng thái readiness</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="w-[300px]">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_configured">Chưa cấu hình (not_configured)</SelectItem>
                  <SelectItem value="needs_review">Cần kiểm tra (needs_review)</SelectItem>
                  <SelectItem value="ready">Sẵn sàng (ready)</SelectItem>
                  <SelectItem value="disabled">Đã vô hiệu (disabled)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="note">Ghi chú readiness</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Đã kiểm tra webhook nhưng còn thiếu quyền API..."
                className="min-h-[100px]"
              />
            </div>
            
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Cập nhật readiness lần cuối: {sender.readiness_last_reviewed_at ? new Date(sender.readiness_last_reviewed_at).toLocaleString("vi-VN") : "Chưa từng cập nhật"}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Đang xử lý..." : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Cập nhật metadata
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
