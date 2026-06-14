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
            <p className="font-semibold">Bạn không có quyền truy cập</p>
            <p className="text-sm mt-1">
              Tính năng Quản lý Tài khoản gửi (Readiness) chỉ dành cho Admin và Sub-Admin. 
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tài khoản gửi</h1>
        <p className="text-muted-foreground mt-1">
          Quản lý siêu dữ liệu (metadata) và mức độ sẵn sàng của các kênh liên lạc.
        </p>
      </div>

      <SenderSafetyNotice />

      <Card className="shadow-sm">
        <CardHeader className="bg-slate-50 border-b pb-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Server className="h-5 w-5 text-slate-500" />
            Danh sách cấu hình
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">Đang tải dữ liệu metadata...</div>
          ) : !senders || senders.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Không tìm thấy tài khoản gửi nào trong hệ thống.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold">Tên người gửi</TableHead>
                    <TableHead className="font-semibold">Kênh</TableHead>
                    <TableHead className="font-semibold">Email gửi</TableHead>
                    <TableHead className="font-semibold text-center">Tình trạng sẵn sàng</TableHead>
                    <TableHead className="font-semibold text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {senders.map((sender) => {
                    const derivedStatus = computeDerivedReadiness(sender);
                    return (
                      <TableRow key={sender.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="font-medium text-slate-900">{sender.name}</div>
                          <div className="text-xs text-slate-500">{sender.provider}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getChannelIcon(sender.channel)}
                            <span className="capitalize text-sm">{sender.channel?.replace("_", " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {sender.sender_email || <span className="italic opacity-50">Không có</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <SenderReadinessBadge status={derivedStatus} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={`/marketing/senders/${sender.id}`}>
                            <Button variant="ghost" size="sm" className="text-primary">
                              Chi tiết <ArrowRight className="ml-1 h-3 w-3" />
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
  );
}
