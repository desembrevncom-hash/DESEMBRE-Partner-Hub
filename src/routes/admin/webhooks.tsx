/* eslint-disable */
import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ResendProcessorPanel } from "@/components/admin/ResendProcessorPanel";
import {
  DatabaseZap,
  Lock,
  Search,
  Eye,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Inbox,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/webhooks")({
  component: WebhookInbox,
});

/* ─────────────────────────────────────────────────────────────────────────────
 * Main Page Component
 * ────────────────────────────────────────────────────────────────────────── */

function WebhookInbox() {
  const { isAdmin, isSubAdmin, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [limit, setLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);

  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("webhook_events")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(limit);

      if (provider !== "all") {
        query = query.eq("provider", provider);
      }
      if (status !== "all") {
        query = query.eq("status", status);
      }
      if (search) {
        query = query.or(
          `event_type.ilike.%${search}%,dedupe_key.ilike.%${search}%,related_message_id.ilike.%${search}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      setEvents(data || []);
      setHasMore((data || []).length === limit);
    } catch (error: any) {
      toast.error("Lỗi tải Webhook Events", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      fetchEvents();
    }
  }, [isAdmin, isSubAdmin, provider, status, limit, search]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans antialiased">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Đang xác thực quyền truy cập...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isSubAdmin) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans antialiased">
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto text-rose-500">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Không có quyền truy cập
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Trang này chỉ dành cho Quản trị viên (Admin) hoặc Sub-admin. Vui lòng quay lại khu vực
              làm việc của bạn.
            </p>
          </div>
          <Link to="/workspace">
            <Button className="w-full rounded-xl bg-slate-900 hover:bg-black font-black text-[10px] h-11 tracking-widest mt-2">
              QUAY LẠI WORKSPACE
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const summary = {
    total: events.length,
    received: events.filter((e) => e.status === "received").length,
    failed: events.filter((e) => e.status === "failed").length,
    resend: events.filter((e) => e.provider === "resend").length,
    zalo: events.filter((e) => e.provider === "zalo" || e.provider === "zalo_zbs").length,
    validSig: events.filter((e) => e.signature_valid).length,
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã copy vào clipboard!");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 font-sans antialiased">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/admin/hub"
              className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              &larr; Admin Hub
            </Link>
          </div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-indigo-500" />
            Webhook Inbox
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Nơi tập kết mọi sự kiện Webhook từ Resend & Zalo trước khi xử lý Logic.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-800 text-sm">Chế độ quan sát (Read-only)</h3>
            <p className="text-amber-700 text-xs mt-1 leading-relaxed">
              Webhook Inbox hiện chỉ là chế độ quan sát. Hệ thống chưa tự động cập nhật Suppression,
              Delivery Logs hoặc Automation từ webhook. Không có dữ liệu khách hàng nào bị ảnh
              hưởng.
            </p>
          </div>
        </div>

        <ResendProcessorPanel onProcessed={() => fetchEvents()} />

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase">Total Shown</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{summary.total}</div>
              <div className="text-[10px] text-slate-400 mt-1">Trang hiện tại</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase">Received</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">{summary.received}</div>
              <div className="text-[10px] text-slate-400 mt-1">Trang hiện tại</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase">Failed</div>
              <div className="text-2xl font-black text-rose-600 mt-1">{summary.failed}</div>
              <div className="text-[10px] text-slate-400 mt-1">Trang hiện tại</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase">Valid Sig</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">{summary.validSig}</div>
              <div className="text-[10px] text-slate-400 mt-1">Trang hiện tại</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase">Resend</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{summary.resend}</div>
              <div className="text-[10px] text-slate-400 mt-1">Trang hiện tại</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase">Zalo</div>
              <div className="text-2xl font-black text-blue-600 mt-1">{summary.zalo}</div>
              <div className="text-[10px] text-slate-400 mt-1">Trang hiện tại</div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-slate-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
            <div className="flex gap-3 items-center w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  placeholder="Tìm Event Type, ID..."
                  className="pl-9 h-9 text-sm rounded-lg"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="w-32 h-9 text-sm rounded-lg">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="resend">Resend</SelectItem>
                  <SelectItem value="zalo">Zalo</SelectItem>
                  <SelectItem value="zalo_zbs">Zalo ZBS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-32 h-9 text-sm rounded-lg">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchEvents()}
              disabled={loading}
              className="h-9 rounded-lg border-slate-200"
            >
              {loading ? "Đang tải..." : "Làm mới"}
            </Button>
          </div>

          <div className="overflow-x-auto w-full max-w-full">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Provider</TableHead>
                  <TableHead className="font-semibold text-slate-600">Event Type</TableHead>
                  <TableHead className="font-semibold text-slate-600">Dedupe Key</TableHead>
                  <TableHead className="font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="font-semibold text-slate-600">Sig Valid</TableHead>
                  <TableHead className="font-semibold text-slate-600">Received At</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      {loading ? "Đang tải dữ liệu..." : "Không tìm thấy Webhook Event nào."}
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize font-bold ${
                            event.provider === "resend"
                              ? "bg-slate-900 text-white"
                              : event.provider.startsWith("zalo")
                                ? "bg-blue-600 text-white"
                                : ""
                          }`}
                        >
                          {event.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">
                        {event.event_type}
                      </TableCell>
                      <TableCell>
                        <div
                          className="font-mono text-xs text-slate-500 truncate max-w-[120px]"
                          title={event.dedupe_key}
                        >
                          {event.dedupe_key?.substring(0, 16)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-semibold capitalize ${
                            event.status === "received"
                              ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                              : event.status === "failed"
                                ? "border-rose-200 text-rose-700 bg-rose-50"
                                : "border-slate-200 text-slate-700 bg-slate-50"
                          }`}
                        >
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.signature_valid ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(event.received_at), "dd/MM/yyyy HH:mm:ss")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500"
                          onClick={() => setSelectedEvent(event)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {hasMore && events.length > 0 && (
            <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50/50">
              <Button
                variant="outline"
                onClick={() => setLimit((l) => l + 50)}
                disabled={loading}
                className="bg-white"
              >
                Tải thêm 50 dòng...
              </Button>
            </div>
          )}
        </Card>

        <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 rounded-xl">
            {selectedEvent && (
              <>
                <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        Event: <span className="text-indigo-600">{selectedEvent.event_type}</span>
                      </DialogTitle>
                      <DialogDescription className="mt-1 flex items-center gap-4">
                        <span>
                          Provider: <strong className="uppercase">{selectedEvent.provider}</strong>
                        </span>
                        <span>
                          Status: <strong className="uppercase">{selectedEvent.status}</strong>
                        </span>
                        <span>
                          Time:{" "}
                          <strong>
                            {format(new Date(selectedEvent.received_at), "dd/MM/yyyy HH:mm:ss")}
                          </strong>
                        </span>
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="text-slate-500 text-xs mb-1 font-semibold">Dedupe Key</div>
                      <div className="font-mono text-slate-800 break-all">
                        {selectedEvent.dedupe_key}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="text-slate-500 text-xs mb-1 font-semibold">
                        Related Message ID
                      </div>
                      <div className="font-mono text-slate-800 break-all">
                        {selectedEvent.related_message_id || "N/A"}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="text-slate-500 text-xs mb-1 font-semibold">
                        Provider Event ID
                      </div>
                      <div className="font-mono text-slate-800 break-all">
                        {selectedEvent.provider_event_id || "N/A"}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="text-slate-500 text-xs mb-1 font-semibold">
                        Signature Valid
                      </div>
                      <div
                        className={`font-bold flex items-center gap-1 ${selectedEvent.signature_valid ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {selectedEvent.signature_valid ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        {selectedEvent.signature_valid ? "VALID" : "INVALID"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <DatabaseZap className="w-4 h-4 text-indigo-500" />
                        Payload
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-500 hover:text-indigo-600"
                        onClick={() =>
                          copyToClipboard(JSON.stringify(selectedEvent.payload, null, 2))
                        }
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy JSON
                      </Button>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                      <pre className="text-emerald-400 font-mono text-[11px] leading-relaxed">
                        {JSON.stringify(selectedEvent.payload, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                        Headers (Redacted)
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-500 hover:text-amber-600"
                        onClick={() =>
                          copyToClipboard(JSON.stringify(selectedEvent.headers_redacted, null, 2))
                        }
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy JSON
                      </Button>
                    </div>
                    <div className="bg-slate-100 rounded-xl p-4 overflow-x-auto border border-slate-200">
                      <pre className="text-slate-700 font-mono text-[11px] leading-relaxed">
                        {JSON.stringify(selectedEvent.headers_redacted, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
