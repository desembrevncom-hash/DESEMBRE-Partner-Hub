import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Mail, MessageCircle, Phone, ArrowRight, Server } from "lucide-react";
import { SenderSafetyNotice } from "@/components/marketing/senders/SenderSafetyNotice";
import { SenderReadinessBadge } from "@/components/marketing/senders/SenderReadinessBadge";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/marketing/senders/")({
  component: SendersReadinessList,
});

function getChannelIcon(channel: string | null) {
  switch (channel) {
    case "email":
      return <Mail className="h-4 w-4 text-blue-500" />;
    case "zalo_oa":
      return <MessageCircle className="h-4 w-4 text-sky-500" />;
    case "facebook_page":
      return <MessageCircle className="h-4 w-4 text-indigo-500" />;
    case "call_manual":
      return <Phone className="h-4 w-4 text-emerald-500" />;
    default:
      return <Server className="h-4 w-4 text-slate-500" />;
  }
}

function computeDerivedReadiness(sender: any) {
  // Computed purely from metadata without external API calls
  const status = sender.readiness_status;
  const health = sender.health_status;
  
  if (sender.channel === "email") {
    if (status === "ready" && sender.sender_email && health !== "error") return "ready";
    if (status === "disabled") return "disabled";
    return "needs_review";
  }
  
  if (sender.channel === "zalo_oa" || sender.channel === "facebook_page") {
    if (status === "ready" && health === "healthy") return "ready";
    if (status === "disabled") return "disabled";
    return "needs_review";
  }

  if (sender.channel === "call_manual" || sender.channel === "export_only") {
    if (status === "ready") return "ready";
    if (status === "disabled") return "disabled";
    return "not_configured";
  }
  
  return status || "not_configured";
}

function SendersReadinessList() {
  const { session } = useAuth();
  
  // M3 requirement: safe query from v_sender_accounts_readiness_safe
  const { data: senders, isLoading, error } = useQuery({
    queryKey: ["v_sender_accounts_readiness_safe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_sender_accounts_readiness_safe")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <SenderSafetyNotice />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center text-red-600 flex flex-col items-center">
            <ShieldAlert className="h-10 w-10 mb-2 opacity-50" />
            <p className="font-semibold">Lỗi truy xuất dữ liệu</p>
            <p className="text-sm mt-1 mb-4">
              Tính năng Quản lý Tài khoản gửi (Readiness) chỉ dành cho Admin và Sub-Admin, hoặc hệ thống chưa được cập nhật DB.
            </p>
            <div className="bg-red-100 text-red-800 text-xs p-3 rounded text-left w-full max-w-md overflow-auto font-mono">
              <strong>Error Details:</strong> {error.message || JSON.stringify(error)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* HEADER SECTION */}
      <div className="bg-white border-b border-slate-100">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold mb-3">
                <Server className="w-3.5 h-3.5" /> Marketing Readiness
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tài khoản gửi</h1>
              <p className="text-sm font-medium text-slate-500 mt-2 max-w-xl">
                Quản lý siêu dữ liệu (metadata) và đánh giá mức độ sẵn sàng của các kênh liên lạc (Email, Zalo, SMS) trước khi đưa vào chiến dịch tự động.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 mt-8 space-y-8">
        <SenderSafetyNotice />

        <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between border-b border-slate-50 bg-white/50 backdrop-blur-xl">
            <div>
              <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                Danh sách cấu hình
              </CardTitle>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Tất cả Sender đang được kết nối với hệ thống
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-400">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-4" />
                <p className="font-medium text-sm">Đang tải dữ liệu metadata...</p>
              </div>
            ) : !senders || senders.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-50/30">
                <Server className="w-12 h-12 text-slate-300 mb-4" />
                <p className="font-semibold text-slate-600">Chưa có Tài khoản gửi nào</p>
                <p className="text-sm mt-1">Không tìm thấy tài khoản gửi nào trong hệ thống.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b-0 hover:bg-slate-50/80">
                      <TableHead className="px-8 py-5 text-left h-auto">Tên người gửi</TableHead>
                      <TableHead className="px-8 py-5 h-auto">Kênh</TableHead>
                      <TableHead className="px-8 py-5 h-auto">Email gửi</TableHead>
                      <TableHead className="px-8 py-5 text-center h-auto">Tình trạng sẵn sàng</TableHead>
                      <TableHead className="px-8 py-5 text-right h-auto">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-50 font-medium">
                    {senders.map((sender) => {
                      const derivedStatus = computeDerivedReadiness(sender);
                      return (
                        <TableRow key={sender.id} className="hover:bg-slate-50/50 transition-all group border-b-slate-50">
                          <TableCell className="px-8 py-5">
                            <div className="font-black text-[13px] text-slate-900">{sender.name}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">{sender.provider || "N/A"}</div>
                          </TableCell>
                          <TableCell className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                {getChannelIcon(sender.channel)}
                              </div>
                              <span className="capitalize font-bold text-slate-700 text-xs">
                                {sender.channel?.replace("_", " ")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-8 py-5 text-xs font-semibold text-slate-600">
                            {sender.sender_email || <span className="italic text-slate-300">Không có</span>}
                          </TableCell>
                          <TableCell className="px-8 py-5 text-center">
                            <SenderReadinessBadge status={derivedStatus} />
                          </TableCell>
                          <TableCell className="px-8 py-5 text-right">
                            <Link to={`/marketing/senders/${sender.id}`}>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="rounded-xl font-bold text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                              >
                                Chi tiết <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
