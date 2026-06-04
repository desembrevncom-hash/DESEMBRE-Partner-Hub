/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  ListFilter,
  ShieldAlert,
  Plus,
  Power,
  FileText,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMTableWrapper } from "@/components/crm/CRMTableWrapper";
import { CRMStatusBadge } from "@/components/crm/CRMStatusBadge";

export const Route = createFileRoute("/marketing/logs")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      campaign_id: (search.campaign_id as string) || undefined,
    };
  },
  component: MarketingLogsPage,
});

function MarketingLogsPage() {
  const { isAdmin, isSubAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"logs" | "suppression">("logs");

  // State for Delivery Logs
  const search = Route.useSearch();
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logChannelFilter, setLogChannelFilter] = useState("all");
  const [logStatusFilter, setLogStatusFilter] = useState("all");
  const [logModeFilter, setLogModeFilter] = useState("all");
  const [logSearchQuery, setLogSearchQuery] = useState(search.campaign_id || "");
  const [activeCampaignFilter, setActiveCampaignFilter] = useState<string | null>(
    search.campaign_id || null,
  );

  // State for Suppression List
  const [suppressionList, setSuppressionList] = useState<any[]>([]);
  const [loadingSuppression, setLoadingSuppression] = useState(false);
  const [isAddSuppressionOpen, setIsAddSuppressionOpen] = useState(false);
  const [newSuppression, setNewSuppression] = useState({
    channel: "email",
    contact_value: "",
    reason: "manual_block",
    note: "",
  });

  const [metadataLogId, setMetadataLogId] = useState<any>(null);

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "test":
        return "Gửi thử";
      case "mock":
        return "Giả lập";
      case "production_pilot":
        return "Pilot nội bộ";
      case "production":
        return "Gửi thật";
      default:
        return mode;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "test_sent":
        return "Gửi thử thành công";
      case "test_failed":
        return "Gửi thử lỗi";
      case "sent":
        return "Đã gửi";
      case "failed":
        return "Lỗi";
      case "skipped":
        return "Bỏ qua";
      case "blocked":
        return "Bị chặn";
      case "prepared":
        return "Đã chuẩn bị";
      case "sending":
        return "Đang gửi";
      default:
        return status;
    }
  };

  const stats = {
    test: logs.filter((l) => l.delivery_metadata?.mode === "test").length,
    mock: logs.filter((l) => l.delivery_metadata?.mode === "mock").length,
    pilot: logs.filter((l) => l.delivery_metadata?.mode === "production_pilot").length,
    failed: logs.filter((l) => l.status?.includes("failed") || l.status === "blocked").length,
    total: logs.length,
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      let query = supabase
        .from("marketing_delivery_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (logChannelFilter !== "all") query = query.eq("channel", logChannelFilter);
      if (logStatusFilter !== "all") query = query.eq("status", logStatusFilter);
      if (logModeFilter !== "all") query = query.eq("mode", logModeFilter); // Note: Assuming mode is also saved at root level, or we can't filter jsonb easily here without raw sql.
      if (logSearchQuery) {
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logSearchQuery)
        ) {
          query = query.eq("campaign_id", logSearchQuery);
        } else {
          // Nếu không phải UUID, tìm kiếm trong JSON (giả định email/zalo nằm trong delivery_metadata.to)
          query = query.or(`delivery_metadata->>to.ilike.%${logSearchQuery}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      toast.error("Lỗi tải logs: " + err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadSuppressionList = async () => {
    if (!isAdmin && !isSubAdmin) return;
    setLoadingSuppression(true);
    try {
      const { data, error } = await supabase
        .from("marketing_suppression_list")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setSuppressionList(data || []);
    } catch (err: any) {
      toast.error("Lỗi tải Suppression List: " + err.message);
    } finally {
      setLoadingSuppression(false);
    }
  };

  useEffect(() => {
    if (activeTab === "logs") {
      loadLogs();
    } else {
      loadSuppressionList();
    }
  }, [activeTab, logChannelFilter, logStatusFilter, logModeFilter, logSearchQuery]);

  const handleAddSuppression = async () => {
    if (!newSuppression.contact_value) return toast.error("Vui lòng nhập liên hệ");
    try {
      let normalized = newSuppression.contact_value.trim();
      if (newSuppression.channel === "email") {
        normalized = normalized.toLowerCase();
      }

      const { error } = await supabase.from("marketing_suppression_list").insert({
        channel: newSuppression.channel,
        contact_value: normalized,
        normalized_contact_value: normalized,
        reason: newSuppression.reason,
        source: "manual",
        note: newSuppression.note,
        is_active: true,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Liên hệ này đã có trong danh sách đen!");
        } else {
          throw error;
        }
      } else {
        toast.success("Thêm vào Suppression List thành công");
        setIsAddSuppressionOpen(false);
        setNewSuppression({
          channel: "email",
          contact_value: "",
          reason: "manual_block",
          note: "",
        });
        loadSuppressionList();
      }
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    }
  };

  const handleToggleSuppressionActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("marketing_suppression_list")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      toast.success("Cập nhật trạng thái thành công");
      loadSuppressionList();
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    }
  };

  return (
    <CRMPageContainer>
      <CRMPageHeader
        title="Delivery Logs & Suppression"
        badgeText="Infrastructure"
        backTo="/marketing/campaigns"
      />

      <div className="space-y-6 mt-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-px">
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${activeTab === "logs" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            Delivery Logs
          </button>
          {(isAdmin || isSubAdmin) && (
            <button
              onClick={() => setActiveTab("suppression")}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${activeTab === "suppression" ? "border-rose-500 text-rose-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              Suppression List (Admin)
            </button>
          )}
        </div>

        {/* Tab Logs */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {activeCampaignFilter && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-indigo-700">
                    Đang lọc theo Campaign:{" "}
                    <span className="font-mono text-indigo-800 bg-indigo-100/50 px-1.5 py-0.5 rounded">
                      {activeCampaignFilter.substring(0, 12)}
                    </span>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px] border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800"
                  onClick={() => {
                    setActiveCampaignFilter(null);
                    setLogSearchQuery("");
                  }}
                >
                  Bỏ lọc
                </Button>
              </div>
            )}

            <CRMCard className="p-4">
              <span className="text-[10px] font-black uppercase text-slate-500 block mb-3">
                {activeCampaignFilter ? "Tổng quan chiến dịch này" : "Tổng quan trang hiện tại"}
              </span>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-500 block mb-1 uppercase font-bold">Gửi thử</span>
                  <span className="text-xl font-black text-slate-800">{stats.test}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-500 block mb-1 uppercase font-bold">Giả lập</span>
                  <span className="text-xl font-black text-slate-800">{stats.mock}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-500 block mb-1 uppercase font-bold">Pilot Nội bộ</span>
                  <span className="text-xl font-black text-slate-800">{stats.pilot}</span>
                </div>
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg">
                  <span className="text-[10px] text-rose-500 block mb-1 uppercase font-bold">Lỗi / Chặn</span>
                  <span className="text-xl font-black text-rose-600">{stats.failed}</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg">
                  <span className="text-[10px] text-indigo-500 block mb-1 uppercase font-bold">Tổng hiển thị</span>
                  <span className="text-xl font-black text-indigo-600">{stats.total}</span>
                </div>
              </div>
            </CRMCard>

            <CRMCard className="p-4 flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Tìm Campaign ID hoặc Email/Zalo..."
                  className="w-64 pl-9 bg-white border-slate-200 h-9 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && loadLogs()}
                />
              </div>
              <select
                value={logChannelFilter}
                onChange={(e) => setLogChannelFilter(e.target.value)}
                className="h-9 rounded-md bg-white border border-slate-200 px-3 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Tất cả kênh</option>
                <option value="email">Email</option>
                <option value="zalo">Zalo</option>
                <option value="zalo_oa">Zalo OA</option>
              </select>
              <select
                value={logModeFilter}
                onChange={(e) => setLogModeFilter(e.target.value)}
                className="h-9 rounded-md bg-white border border-slate-200 px-3 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Tất cả Mode</option>
                <option value="test">Gửi thử</option>
                <option value="mock">Giả lập</option>
                <option value="production_pilot">Pilot Nội bộ</option>
              </select>
              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value)}
                className="h-9 rounded-md bg-white border border-slate-200 px-3 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="test_sent">Gửi thử thành công</option>
                <option value="test_failed">Gửi thử lỗi</option>
                <option value="sent">Đã gửi</option>
                <option value="failed">Lỗi</option>
                <option value="blocked">Bị chặn</option>
              </select>
              <Button onClick={loadLogs} variant="outline" className="h-9 px-3">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </CRMCard>

            <CRMCard className="p-0 overflow-hidden">
              <CRMTableWrapper>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium uppercase text-[10px] tracking-wider">Thời gian</th>
                      <th className="px-4 py-3 font-medium uppercase text-[10px] tracking-wider">Channel</th>
                      <th className="px-4 py-3 font-medium uppercase text-[10px] tracking-wider">Recipient</th>
                      <th className="px-4 py-3 font-medium uppercase text-[10px] tracking-wider">Status / Mode</th>
                      <th className="px-4 py-3 font-medium uppercase text-[10px] tracking-wider">Campaign ID</th>
                      <th className="px-4 py-3 font-medium uppercase text-[10px] tracking-wider">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingLogs ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-500" />
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-500">
                          Không tìm thấy logs
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString("vi-VN")}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] uppercase">
                              {log.channel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {log.delivery_metadata?.to ||
                              log.delivery_metadata?.email ||
                              log.delivery_metadata?.phone ||
                              "-"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <CRMStatusBadge
                                status={
                                  log.status?.includes("failed") || log.status === "blocked"
                                    ? "error"
                                    : log.status?.includes("sent") || log.status?.includes("delivered")
                                      ? "success"
                                      : log.status?.includes("skipped") || log.status?.includes("suppressed")
                                        ? "warning"
                                        : "info"
                                }
                                label={getStatusLabel(log.status)}
                              />
                              {log.delivery_metadata?.mode && (
                                <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm uppercase font-bold tracking-widest border border-slate-200">
                                  {getModeLabel(log.delivery_metadata.mode)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-mono text-[10px]">
                            {log.campaign_id?.substring(0, 8) || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-[11px] max-w-[200px]">
                            <div className="truncate mb-1" title={log.reason}>
                              {log.reason || "-"}
                            </div>
                            {log.delivery_metadata?.provider_message_id && (
                              <div className="text-[9px] text-slate-500 mb-1 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 w-fit">
                                Mã NSX: {log.delivery_metadata.provider_message_id.substring(0, 16)}...
                              </div>
                            )}
                            {log.delivery_metadata && (
                              <button
                                onClick={() => setMetadataLogId(log)}
                                className="text-[9px] text-indigo-500 hover:text-indigo-600 underline font-bold"
                              >
                                Xem chi tiết kỹ thuật
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CRMTableWrapper>
            </CRMCard>
          </div>
        )}

        {/* Tab Suppression List */}
        {activeTab === "suppression" && (isAdmin || isSubAdmin) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Danh sách chặn vĩnh viễn không được nhận thông điệp qua các kênh tương ứng.
              </p>
              <Button
                onClick={() => setIsAddSuppressionOpen(true)}
                className="h-9 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Thêm Record
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingSuppression ? (
                <div className="col-span-full py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                </div>
              ) : suppressionList.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-500 text-sm">
                  Chưa có bản ghi nào trong Suppression List.
                </div>
              ) : (
                suppressionList.map((s) => (
                  <CRMCard
                    key={s.id}
                    className={`${s.is_active ? "border-rose-200" : "opacity-60"} space-y-3`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert
                          className={`w-4 h-4 ${s.is_active ? "text-rose-500" : "text-slate-600"}`}
                        />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          {s.channel}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleSuppressionActive(s.id, s.is_active)}
                        className={`p-1.5 rounded-lg transition-all ${s.is_active ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}
                        title={
                          s.is_active ? "Vô hiệu hóa (Cho phép gửi lại)" : "Kích hoạt (Chặn gửi)"
                        }
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <strong className="text-sm font-mono text-slate-800 break-all">
                        {s.normalized_contact_value}
                      </strong>
                    </div>

                    <div className="bg-slate-50 rounded p-2 text-[10px] space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Lý do:</span>
                        <span className="text-rose-600 font-medium">{s.reason}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Nguồn:</span>
                        <span className="text-slate-700 font-medium">{s.source}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Ngày tạo:</span>
                        <span className="text-slate-700 font-medium">{new Date(s.created_at).toLocaleDateString("vi-VN")}</span>
                      </div>
                    </div>
                    {s.note && (
                      <p className="text-[10px] text-slate-500 italic mt-2 text-center border-t border-slate-100 pt-2">
                        {s.note}
                      </p>
                    )}
                  </CRMCard>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Add Suppression */}
      <Dialog open={isAddSuppressionOpen} onOpenChange={setIsAddSuppressionOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-rose-600 font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Thêm Danh sách đen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Channel</label>
              <select
                value={newSuppression.channel}
                onChange={(e) => setNewSuppression({ ...newSuppression, channel: e.target.value })}
                className="w-full h-9 rounded-md bg-white border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="zalo_id">Zalo ID</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Contact Value</label>
              <Input
                value={newSuppression.contact_value}
                onChange={(e) =>
                  setNewSuppression({ ...newSuppression, contact_value: e.target.value })
                }
                placeholder="Email hoặc Zalo ID"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Reason</label>
              <select
                value={newSuppression.reason}
                onChange={(e) => setNewSuppression({ ...newSuppression, reason: e.target.value })}
                className="w-full h-9 rounded-md bg-white border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="bounced">Bounced (Lỗi gửi)</option>
                <option value="complaint">Complaint (Báo cáo Spam)</option>
                <option value="manual_block">Manual Block (Chặn thủ công)</option>
                <option value="unsubscribe">Unsubscribe (Hủy nhận tin)</option>
                <option value="invalid_contact">Invalid Contact (Sai định dạng)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Note (Optional)</label>
              <Input
                value={newSuppression.note}
                onChange={(e) => setNewSuppression({ ...newSuppression, note: e.target.value })}
                placeholder="Ghi chú thêm..."
                className="h-9"
              />
            </div>
            <Button
              onClick={handleAddSuppression}
              className="w-full h-10 mt-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl"
            >
              Thêm vào Blacklist
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!metadataLogId} onOpenChange={(open) => !open && setMetadataLogId(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-bold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" /> Chi tiết Metadata
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 bg-slate-900 p-3 rounded-xl border border-slate-800 text-slate-300 font-mono text-[10px] overflow-auto max-h-[60vh] whitespace-pre-wrap">
            {metadataLogId ? JSON.stringify(metadataLogId.delivery_metadata, null, 2) : ""}
          </div>
        </DialogContent>
      </Dialog>
    </CRMPageContainer>
  );
}
