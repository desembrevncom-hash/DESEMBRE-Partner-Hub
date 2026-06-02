import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield,
  Lock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Power,
  PowerOff,
  Eye,
  Radio,
  Mail,
  MessageCircle,
  Phone,
  Users,
  Activity,
  RotateCcw,
  Clock,
  ChevronRight,
  Info,
  Zap,
  Link2,
  Loader2,
  X,
  Plus,
  Send,
  Filter,
  RotateCw,
  ExternalLink,
  ChevronDown,
  TrendingUp,
  AlertOctagon,
  ListFilter,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ZnsTemplateDialog } from "@/components/marketing/ZnsTemplateDialog";
import { ZnsTestSendDialog } from "@/components/marketing/ZnsTestSendDialog";
import { AddSenderWizard } from "@/components/senders/AddSenderWizard";
import { EditSenderModal } from "@/components/senders/EditSenderModal";
import type { ZnsTemplate } from "@/lib/znsTemplateValidation";
import { ERROR_CODE_LABELS, STATUS_COLORS, type ZnsErrorCode } from "@/lib/znsErrorMap";

export const Route = createFileRoute("/admin/sender-accounts")({
  component: SenderAccountsPage,
});

// ─── Types ─────────────────────────────────────────────────────────────────
interface BusinessSender {
  id: string;
  name: string;
  provider: string;
  channel: string;
  status: string;
  is_active: boolean;
  auth_type: string | null;
  sender_email: string | null;
  sender_name: string | null;
  last_used_at: string | null;
  last_checked_at: string | null;
  daily_usage: number;
  daily_limit: number;
  health_status: string;
  last_error: string | null;
  is_default: boolean;
  secret_prefix?: string | null;
  domain?: string | null;
}

interface PersonalSender {
  id: string;
  user_id: string;
  platform: string;
  account_name: string;
  account_identifier: string | null;
  is_active: boolean;
  status: string;
  last_verified_at: string | null;
  health_status: string;
  last_error: string | null;
  is_default: boolean;
  // joined from profiles
  staff_name?: string;
  staff_email?: string;
  staff_role?: string;
  linked_count?: number;
}

interface AuditLog {
  id: string;
  action: string;
  sender_type: string;
  result: string;
  note: string | null;
  created_at: string;
  performed_by: string;
  staff_name?: string;
}

interface DeliveryLog {
  id: string;
  customer_id: string | null;
  campaign_id: string | null;
  template_id: string | null;
  sender_account_id: string | null;
  personal_sender_id: string | null;
  channel: string;
  mode: string;
  status: string;
  reason: string | null;
  provider_message_id: string | null;
  created_by: string | null;
  created_at: string;
  // ZNS-4 observability fields
  dedupe_key: string | null;
  normalized_error_code: string | null;
  retry_count: number;
  last_retry_at: string | null;
  provider_response: Record<string, unknown> | null;
  delivery_metadata: Record<string, unknown> | null;
  // joined relations
  customers?: { name: string; business_name: string | null } | null;
  marketing_campaigns?: { name: string } | null;
  sender_name?: string;
  operator_name?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function HealthBadge({ status, provider, lastError }: { status: string, provider?: string, lastError?: string | null }) {
  if (status === "healthy") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-black uppercase tracking-wider">
        <CheckCircle2 className="w-3.5 h-3.5" /> Sẵn sàng
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-black uppercase tracking-wider">
        <AlertTriangle className="w-3.5 h-3.5" /> Domain chưa xác thực
      </span>
    );
  }
  if (status === "error") {
    const isMissingApiKey = lastError && lastError.toLowerCase().includes("thiếu cấu hình");
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-black uppercase tracking-wider">
        <XCircle className="w-3.5 h-3.5" /> {isMissingApiKey ? "Thiếu API Key" : "Lỗi"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-wider">
      <HelpCircle className="w-3.5 h-3.5" /> Chưa rõ
    </span>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  const c = (channel || "").toLowerCase();
  if (c.includes("zalo")) return <MessageCircle className="w-4 h-4 text-blue-500" />;
  if (c.includes("email")) return <Mail className="w-4 h-4 text-indigo-500" />;
  if (c.includes("sms") || c.includes("phone")) return <Phone className="w-4 h-4 text-emerald-500" />;
  return <Radio className="w-4 h-4 text-slate-400" />;
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

// ─── Main Component ──────────────────────────────────────────────────────────
function SenderAccountsPage() {
  const { isAdmin, isSubAdmin, loading: authLoading, user } = useAuth();
  const [businessSenders, setBusinessSenders] = useState<BusinessSender[]>([]);
  const [personalSenders, setPersonalSenders] = useState<PersonalSender[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [znsTemplates, setZnsTemplates] = useState<ZnsTemplate[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"business" | "personal" | "logs" | "delivery_logs" | "zns_templates" | "retry_queue">("business");
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [retryQueue, setRetryQueue] = useState<any[]>([]);
  const [processingRetry, setProcessingRetry] = useState(false);


  // ── Delivery Log Filters ───────────────────────────────────────
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSender, setFilterSender] = useState<string>("all");
  const [filterErrorCode, setFilterErrorCode] = useState<string>("all");
  
  // ── Detail Drawer ─────────────────────────────────────────────
  const [selectedLog, setSelectedLog] = useState<DeliveryLog | null>(null);

  // ── Zalo OA Connect state ────────────────────────────────────
  const [zaloModalOpen, setZaloModalOpen] = useState(false);
  const [zaloConnecting, setZaloConnecting] = useState(false);
  const [zaloSenderName, setZaloSenderName] = useState("");
  const [zaloAppId, setZaloAppId] = useState("");
  const [zaloOaId, setZaloOaId] = useState("");
  
  // ── Resend Config state ──────────────────────────────────────
  const [resendModalOpen, setResendModalOpen] = useState(false);
  const [resendConfiguring, setResendConfiguring] = useState(false);
  const [resendSenderId, setResendSenderId] = useState<string | null>(null);
  const [resendSenderName, setResendSenderName] = useState("");
  const [resendSenderEmail, setResendSenderEmail] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");

  const handleConfigureResend = async () => {
    if (!resendSenderName.trim()) return toast.error("Vui lòng nhập tên hiển thị");
    if (!resendSenderEmail.trim() || !resendSenderEmail.includes("@")) return toast.error("Vui lòng nhập Email hợp lệ");
    
    setResendConfiguring(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Chưa đăng nhập");

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sender-account-configure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          provider: "resend",
          sender_account_id: resendSenderId,
          sender_name: resendSenderName,
          sender_email: resendSenderEmail,
          api_key: resendApiKey
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Lỗi cấu hình Resend");
      }

      toast.success(data.message || "Cấu hình Resend thành công");
      setResendModalOpen(false);
      fetchData(); // Reload table
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResendConfiguring(false);
      setResendApiKey(""); // Cấm lưu plaintext, luôn clear input
    }
  };
  
  // ── ZNS Template state ───────────────────────────────────────
  const [znsTemplateModalOpen, setZnsTemplateModalOpen] = useState(false);
  const [editingZnsTemplate, setEditingZnsTemplate] = useState<ZnsTemplate | null>(null);
  
  const [znsTestSendModalOpen, setZnsTestSendModalOpen] = useState(false);
  const [testingZnsTemplate, setTestingZnsTemplate] = useState<ZnsTemplate | null>(null);

  // ── M-Infra 3A Provisioning & Archiving state ────────────────
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reconnectSender, setReconnectSender] = useState<BusinessSender | null>(null);
  const [reconnectModalOpen, setReconnectModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSenderData, setEditSenderData] = useState<any | null>(null);

  // ── Guides state ──────────────────────────────────────────────
  const [showGuideGmail, setShowGuideGmail] = useState(false);
  const [showGuideResend, setShowGuideResend] = useState(false);

  // ── Handle connected= and code/state query params (Zalo OAuth callback) ───────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const reason = params.get("reason");
    const code = params.get("code");
    const state = params.get("state");

    if (code && state) {
      toast.loading("🔄 Đang xử lý xác thực Zalo OA...", { id: "zalo-oauth-loading" });
      const targetUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zalo-oauth-callback?code=${code}&state=${encodeURIComponent(state)}`;
      window.location.href = targetUrl;
      return;
    }

    if (connected === "zalo") {
      toast.success("✅ Kết nối Zalo OA thành công!", {
        id: "zalo-oauth-loading",
        description: "Sender account đã được tạo và đánh dấu Healthy.",
      });
      // Xóa params khỏi URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (connected === "error") {
      toast.error("❌ Kết nối Zalo OA thất bại", {
        id: "zalo-oauth-loading",
        description: reason ? `Lý do: ${reason}` : "Vui lòng kiểm tra App ID và thử lại.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ── Fetch Data ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      // Business Senders
      const { data: biz } = await supabase
        .from("sender_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      setBusinessSenders(biz || []);

      // ZNS Templates
      const { data: zns } = await supabase
        .from("zns_templates")
        .select("*")
        .order("created_at", { ascending: false });
        
      setZnsTemplates(zns || []);

      // Personal Senders — join profiles for staff info
      const { data: personal } = await supabase
        .from("user_communication_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (personal && personal.length > 0) {
        const userIds = [...new Set(personal.map((p: any) => p.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", userIds);

        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const profileMap: Record<string, any> = {};
        (profilesData || []).forEach((p: any) => { profileMap[p.id] = p; });

        const roleMap: Record<string, string> = {};
        (rolesData || []).forEach((r: any) => {
          if (!roleMap[r.user_id]) roleMap[r.user_id] = r.role;
        });

        const enriched = personal.map((p: any) => ({
          ...p,
          staff_name: profileMap[p.user_id]?.display_name || profileMap[p.user_id]?.email || "Chưa rõ",
          staff_email: profileMap[p.user_id]?.email || "",
          staff_role: roleMap[p.user_id] || "—",
        }));

        setPersonalSenders(enriched);
      } else {
        setPersonalSenders([]);
      }

      // Audit Logs
      const { data: logs } = await supabase
        .from("sender_action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      setAuditLogs(logs || []);

      // Delivery Logs
      const { data: delLogs } = await supabase
        .from("marketing_delivery_logs")
        .select(`
          id,
          customer_id,
          campaign_id,
          template_id,
          sender_account_id,
          personal_sender_id,
          channel,
          mode,
          status,
          reason,
          provider_message_id,
          created_by,
          created_at,
          dedupe_key,
          normalized_error_code,
          retry_count,
          last_retry_at,
          provider_response,
          delivery_metadata,
          customers ( name, business_name ),
          marketing_campaigns ( name )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (delLogs) {
        // Enrich logs client-side with profiles and sender names
        const uniqueUserIds = [...new Set(delLogs.map((l: any) => l.created_by).filter(Boolean))];
        const logProfileMap: Record<string, string> = {};
        if (uniqueUserIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, display_name, email")
            .in("id", uniqueUserIds);
          (profilesData || []).forEach((p: any) => {
            logProfileMap[p.id] = p.display_name || p.email || "Chưa rõ";
          });
        }

        const enrichedLogs = delLogs.map((l: any) => {
          let senderName = "—";
          if (l.sender_account_id) {
            const foundBiz = (biz || []).find((b: any) => b.id === l.sender_account_id);
            senderName = foundBiz ? `Biz: ${foundBiz.name}` : "Business Sender";
          } else if (l.personal_sender_id) {
            const foundPers = (personal || []).find((p: any) => p.id === l.personal_sender_id);
            senderName = foundPers ? `Pers: ${foundPers.account_name || foundPers.staff_name}` : "Personal Sender";
          }

          return {
            ...l,
            sender_name: senderName,
            operator_name: logProfileMap[l.created_by] || "Hệ thống/Sale",
          };
        });

        setDeliveryLogs(enrichedLogs);
      } else {
        setDeliveryLogs([]);
      }

      // Retry Queue
      const { data: retries } = await supabase
        .from("marketing_retry_queue")
        .select(`
          id, status, retry_count, max_retries, next_retry_at, retry_reason,
          normalized_error_code, created_at,
          customer:customers (name),
          template:zns_templates (template_name),
          sender:sender_accounts (name)
        `)
        .in("status", ["pending", "retrying", "abandoned"])
        .order("next_retry_at", { ascending: true })
        .limit(50);
        
      setRetryQueue(retries || []);

    } catch (e: any) {
      toast.error("Lỗi tải dữ liệu: " + e.message);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin || isSubAdmin) fetchData();
  }, [isAdmin, isSubAdmin, fetchData]);

  // ── Start Zalo OA OAuth flow ──────────────────────────────────
  const handleStartZaloOAuth = async () => {
    if (!zaloSenderName.trim()) {
      toast.error("Vui lòng nhập tên cấu hình Sender");
      return;
    }
    if (!zaloAppId.trim()) {
      toast.error("Vui lòng nhập App ID của Zalo App");
      return;
    }
    setZaloConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Không tìm thấy session");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zalo-oauth-start`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender_name: zaloSenderName.trim(),
            app_id: zaloAppId.trim(),
            oa_id: zaloOaId.trim(),
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.oauth_url) {
        throw new Error(json.error || "Không nhận được OAuth URL");
      }

      // Chuyển hướng sang Zalo OAuth Permission Screen
      setZaloModalOpen(false);
      toast.success("Đang chuyển hướng sang Zalo...", { duration: 2000 });
      window.location.href = json.oauth_url;
    } catch (e: any) {
      toast.error("Lỗi kết nối Zalo OA: " + e.message);
    } finally {
      setZaloConnecting(false);
    }
  };

  // ── Test Connection ─────────────────────────────────────────────────────────
  const testConnection = async (sender: BusinessSender | PersonalSender, senderType: "business" | "personal") => {
    setTestingId(sender.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Không tìm thấy session");

      let endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-sender-connection`;
      let body = { sender_id: sender.id, sender_type: senderType };

      if (senderType === "business" && ("provider" in sender) && (sender.provider === "resend" || sender.provider === "zalo_oa")) {
        endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sender-account-health-check`;
        body = { provider: sender.provider, sender_account_id: sender.id } as any;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Lỗi không xác định");

      // Handle response from sender-account-health-check
      if (senderType === "business" && ("provider" in sender) && (sender.provider === "resend" || sender.provider === "zalo_oa")) {
        const isHealthy = json.configured && (!json.domain_status || json.domain_status === "verified");
        const health_status = isHealthy ? "healthy" : "error";
        const last_error = isHealthy ? null : json.message;
        
        await supabase.from("sender_accounts")
          .update({ 
            health_status, 
            last_error, 
            last_checked_at: new Date().toISOString(),
            status: isHealthy ? "active" : "error",
            is_active: isHealthy,
            updated_at: new Date().toISOString()
          })
          .eq("id", sender.id);
        
        toast[isHealthy ? "success" : "error"]("Kiểm tra cấu hình", { description: json.message });
      } else {
        // Legacy handling
        const healthLabel: Record<string, string> = {
          healthy: "✅ Kết nối tốt",
          warning: "⚠️ Cảnh báo",
          error: "❌ Lỗi kết nối",
        };
        toast[json.health_status === "healthy" ? "success" : json.health_status === "warning" ? "warning" : "error"](
          healthLabel[json.health_status] || "Kiểm tra xong",
          { description: json.last_error || "Không có lỗi" }
        );

        // Nếu test thành công và là business sender, tự động chuyển trạng thái thành active
        if (json.health_status === "healthy" && senderType === "business") {
          await supabase.from("sender_accounts")
            .update({ status: "active", is_active: true, updated_at: new Date().toISOString() })
            .eq("id", sender.id)
            .eq("status", "pending_verification");
        }
      }

      await fetchData();
    } catch (e: any) {
      toast.error("Lỗi khi kiểm tra: " + e.message);
    } finally {
      setTestingId(null);
    }
  };

  // ── Toggle Business Sender ──────────────────────────────────────────────────
  const toggleBusinessSender = async (sender: BusinessSender) => {
    setTogglingId(sender.id);
    const newActive = !sender.is_active;
    const action = newActive ? "enable" : "disable";
    try {
      await supabase.from("sender_accounts")
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq("id", sender.id);

      await supabase.from("sender_action_logs").insert({
        action,
        sender_id: sender.id,
        sender_type: "business",
        performed_by: user?.id,
        result: "ok",
        note: `${action === "enable" ? "Kích hoạt" : "Vô hiệu hóa"} sender: ${sender.name}`,
      });

      toast.success(newActive ? `Đã kích hoạt ${sender.name}` : `Đã vô hiệu hóa ${sender.name}`);
      await fetchData();
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Archive Business Sender ─────────────────────────────────────────────────
  const archiveBusinessSender = async (sender: BusinessSender) => {
    if (!confirm("Sender sẽ bị ẩn khỏi danh sách chính nhưng lịch sử gửi vẫn được giữ. Bạn có chắc chắn muốn lưu trữ?")) {
      return;
    }
    setTogglingId(sender.id);
    try {
      const { error } = await supabase.from("sender_accounts")
        .update({ 
          status: "archived", 
          archived_at: new Date().toISOString(),
          archived_by: user?.id,
          updated_at: new Date().toISOString() 
        })
        .eq("id", sender.id);

      if (error) throw error;

      await supabase.from("sender_action_logs").insert({
        action: "archive_sender",
        sender_id: sender.id,
        sender_type: "business",
        performed_by: user?.id,
        result: "ok",
        note: `Lưu trữ sender: ${sender.name}`,
      });

      toast.success(`Đã lưu trữ sender "${sender.name}"`);
      await fetchData();
    } catch (e: any) {
      toast.error("Lỗi lưu trữ: " + e.message);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Restore Business Sender ─────────────────────────────────────────────────
  const restoreBusinessSender = async (sender: BusinessSender) => {
    if (!confirm("Khôi phục tài khoản này về trạng thái Disabled?")) {
      return;
    }
    setTogglingId(sender.id);
    try {
      const { error } = await supabase.from("sender_accounts")
        .update({ 
          status: "disabled", 
          health_status: "unknown",
          archived_at: null,
          archived_by: null,
          updated_at: new Date().toISOString() 
        })
        .eq("id", sender.id);

      if (error) throw error;

      await supabase.from("sender_action_logs").insert({
        action: "restore_sender",
        sender_id: sender.id,
        sender_type: "business",
        performed_by: user?.id,
        result: "ok",
        note: `Khôi phục sender: ${sender.name}`,
      });

      toast.success(`Đã khôi phục sender "${sender.name}" về trạng thái Disabled`);
      await fetchData();
    } catch (e: any) {
      toast.error("Lỗi khôi phục: " + e.message);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Mark Needs Reconnect ────────────────────────────────────────────────────
  const markReconnect = async (account: PersonalSender) => {
    setTogglingId(account.id);
    try {
      await supabase.from("user_communication_accounts")
        .update({
          health_status: "warning",
          last_error: "Được đánh dấu cần kết nối lại bởi Admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      await supabase.from("sender_action_logs").insert({
        action: "mark_reconnect",
        sender_id: account.id,
        sender_type: "personal",
        performed_by: user?.id,
        result: "warning",
        note: `Đánh dấu cần kết nối lại: ${account.staff_name} — ${account.platform}`,
      });

      toast.warning(`Đã đánh dấu ${account.staff_name} cần kết nối lại`);
      await fetchData();
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Disable Personal Sender ─────────────────────────────────────────────────
  const togglePersonalSender = async (account: PersonalSender) => {
    setTogglingId(account.id);
    const newActive = !account.is_active;
    const action = newActive ? "enable" : "disable";
    try {
      await supabase.from("user_communication_accounts")
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq("id", account.id);

      await supabase.from("sender_action_logs").insert({
        action,
        sender_id: account.id,
        sender_type: "personal",
        performed_by: user?.id,
        result: "ok",
        note: `${action} personal sender: ${account.staff_name} / ${account.platform}`,
      });

      toast.success(newActive ? "Đã kích hoạt tài khoản" : "Đã vô hiệu hóa tài khoản");
      await fetchData();
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center animate-pulse">
            <Shield className="w-6 h-6 text-indigo-500" />
          </div>
          <p className="text-sm font-bold text-slate-400">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isSubAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">
          Trang Sender Accounts chỉ dành riêng cho Admin và Sub Admin.
        </p>
        <Link to="/workspace" className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const bizHealthy = businessSenders.filter(s => s.health_status === "healthy").length;
  const bizError = businessSenders.filter(s => s.health_status === "error").length;
  const bizWarning = businessSenders.filter(s => s.health_status === "warning").length;

  const personalHealthy = personalSenders.filter(s => s.health_status === "healthy").length;
  const personalNeeds = personalSenders.filter(s => !s.is_active || s.health_status === "error" || s.health_status === "warning").length;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-20 font-sans">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="bg-white/90 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Sender Accounts</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                <Zap className="w-3 h-3 fill-indigo-500" /> Quản lý kênh gửi tin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-purple-200 hover:bg-purple-50 hover:text-purple-700 font-bold text-xs h-9 px-4 gap-2 bg-purple-50/10 text-purple-700 hidden sm:inline-flex"
            >
              <Link to="/marketing/templates">📝 Template Library</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loadingData}
              className="rounded-xl border-slate-200 font-bold text-xs h-9 px-4 gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
            <Button
              id="btn-add-sender"
              size="sm"
              onClick={() => {
                setWizardOpen(true);
              }}
              className="rounded-xl font-bold text-xs h-9 px-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200"
            >
              <Plus className="w-4 h-4" />
              Thêm Sender
            </Button>
            <Link
              to="/admin/hub"
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
            >
              Admin Hub <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-7xl space-y-8">

        {/* ── SUMMARY STRIP ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Tổ chức — Sẵn sàng" value={bizHealthy} color="emerald" />
          <StatCard label="Tổ chức — Lỗi" value={bizError} color="rose" />
          <StatCard label="Cá nhân — OK" value={personalHealthy} color="indigo" />
          <StatCard label="Cá nhân — Cần xử lý" value={personalNeeds} color="amber" />
        </div>

        {/* ── ROUTING RULES READ-ONLY ─────────────────────────────────────────── */}
        <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Info className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <CardTitle className="text-sm font-black text-slate-800">Luồng Phân Tuyến (Routing Rules)</CardTitle>
                  <CardDescription className="text-xs">Chỉ xem — Logic phân tuyến kênh gửi mặc định</CardDescription>
                </div>
              </div>
              <Badge className="bg-slate-100 text-slate-500 border-none text-[10px] font-black uppercase">MẶC ĐỊNH</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { rule: "Email Campaign", arrow: "→", target: "Business Email Sender", icon: <Mail className="w-4 h-4 text-indigo-500" />, color: "indigo" },
                { rule: "Google Calendar Invite", arrow: "→", target: "Gmail Sender", icon: <Mail className="w-4 h-4 text-purple-500" />, color: "purple" },
                { rule: "Zalo OA Campaign", arrow: "→", target: "Business Zalo OA Sender", icon: <MessageCircle className="w-4 h-4 text-blue-500" />, color: "blue" },
                { rule: "Sale Follow-up", arrow: "→", target: "Personal Zalo / Phone", icon: <Phone className="w-4 h-4 text-emerald-500" />, color: "emerald" },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  {r.icon}
                  <span className="text-xs font-bold text-slate-700">{r.rule}</span>
                  <span className="text-slate-300 font-bold mx-1">{r.arrow}</span>
                  <span className="text-xs font-bold text-slate-900 flex-1">{r.target}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── TABS ─────────────────────────────────────────────────────────────── */}
        <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1">
          {[
            { key: "business", label: "Business Senders", count: businessSenders.length },
            { key: "personal", label: "Personal Senders", count: personalSenders.length },
            { key: "zns_templates", label: "ZNS Templates", count: znsTemplates.length },
            { key: "logs", label: "Audit Log", count: auditLogs.length },
            { key: "delivery_logs", label: "Delivery Logs", count: deliveryLogs.length },
            { key: "retry_queue", label: "Retry Queue", count: retryQueue.length },
          ].map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-black ${
                activeTab === tab.key ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* ── BUSINESS SENDERS TABLE ─────────────────────────────────────────── */}
        {activeTab === "business" && (
          <div className="space-y-4">
            {/* Hướng dẫn thêm tài khoản Business */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-600 animate-bounce" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900">Hướng dẫn cấu hình & quản trị Business Senders</h4>
                </div>
                <Link
                  to="/admin/settings"
                  className="text-xs font-black text-indigo-700 hover:text-indigo-950 flex items-center gap-1 bg-white/80 hover:bg-white border border-indigo-200 px-3 py-1 rounded-xl shadow-3xs transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Xem Tài Liệu Cấu Hình
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-indigo-950/80">
                <div className="space-y-1 bg-white/60 p-3.5 rounded-xl border border-indigo-100/50">
                  <span className="font-bold text-indigo-900 block">💬 Zalo OA doanh nghiệp</span>
                  <p className="text-[11px] leading-relaxed">Kết nối bằng cách bấm trực tiếp nút <strong>“Kết nối Zalo OA”</strong> ở phía trên. Hệ thống sẽ tự động xác thực qua OAuth 2.0 PKCE và lưu token an toàn ở Server.</p>
                </div>
                <div className="space-y-1 bg-white/60 p-3.5 rounded-xl border border-indigo-100/50">
                  <span className="font-bold text-indigo-900 block">✉️ Resend Email</span>
                  <p className="text-[11px] leading-relaxed">Được cấu hình bởi kỹ thuật viên qua <strong>Edge Secrets (RESEND_API_KEY)</strong>. UI chỉ hiển thị trạng thái hoạt động và lịch sử gửi.</p>
                </div>
                <div className="space-y-1 bg-white/60 p-3.5 rounded-xl border border-purple-100/80">
                  <span className="font-bold text-indigo-900 block">📧 Gmail (Lịch Hẹn)</span>
                  <p className="text-[11px] leading-relaxed">Dùng cho <strong>Calendar Invite</strong> — gửi thư mời lịch hẹn tới khách hàng qua Google Calendar. Cấu hình bằng Google OAuth 2.0 Credentials ngay trên giao diện (nút <strong>Sửa</strong>).</p>
                </div>
              </div>

              {/* Resend Connection Guide */}
              <div className="mt-3 bg-white/80 border border-indigo-100 rounded-xl overflow-hidden shadow-3xs transition-all duration-200">
                <button
                  onClick={() => setShowGuideResend(!showGuideResend)}
                  className="w-full bg-indigo-900/5 hover:bg-indigo-900/10 px-4 py-3 flex items-center justify-between border-b border-indigo-100/50 transition-colors"
                >
                  <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider flex items-center gap-2">
                    ✉️ Hướng dẫn kết nối Resend Email
                  </span>
                  <ChevronDown className={`w-4 h-4 text-indigo-700 transition-transform duration-200 ${showGuideResend ? 'rotate-180' : ''}`} />
                </button>
                {showGuideResend && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-700">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">1</span>
                        <span className="font-black text-indigo-900">Tạo tài khoản và lấy API Key</span>
                      </div>
                      <ul className="pl-7 space-y-1 text-[10px] leading-relaxed text-slate-600 list-disc">
                        <li>Vào <strong>resend.com</strong> → Tạo tài khoản và đăng nhập</li>
                        <li>Vào mục <strong>API Keys</strong> → <strong>Create API Key</strong></li>
                        <li>Phân quyền: <strong>Full Access</strong> hoặc <strong>Sending access</strong></li>
                        <li>Copy chuỗi khóa bí mật (bắt đầu bằng <code className="bg-slate-100 px-1 rounded">re_</code>)</li>
                      </ul>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">2</span>
                        <span className="font-black text-indigo-900">Xác thực tên miền (Domain)</span>
                      </div>
                      <ul className="pl-7 space-y-1 text-[10px] leading-relaxed text-slate-600 list-disc">
                        <li>Vào mục <strong>Domains</strong> → <strong>Add Domain</strong></li>
                        <li>Nhập tên miền của bạn (ví dụ: <code className="bg-slate-100 px-1 rounded">desembrevn.com</code>)</li>
                        <li>Vào trình quản lý DNS của tên miền (Cloudflare, Mắt Bão...)</li>
                        <li>Thêm các bản ghi <strong>TXT</strong> và <strong>MX</strong> mà Resend yêu cầu</li>
                        <li>Chờ Resend xác thực (Status đổi thành <strong>Verified</strong>)</li>
                      </ul>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">3</span>
                        <span className="font-black text-indigo-900">Cập nhật vào Partner Hub</span>
                      </div>
                      <ul className="pl-7 space-y-1 text-[10px] leading-relaxed text-slate-600 list-disc">
                        <li>Bấm nút <strong>Sửa</strong> ở Sender Resend bên dưới → dán chuỗi API Key vào ô <strong>Khóa API Resend</strong></li>
                        <li>Bấm <strong>Lưu thay đổi</strong> rồi bấm nút <strong>Test</strong> để kiểm tra kết nối</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Gmail Connection Guide */}
              <div className="mt-3 bg-white/80 border border-purple-100 rounded-xl overflow-hidden shadow-3xs transition-all duration-200">
                <button
                  onClick={() => setShowGuideGmail(!showGuideGmail)}
                  className="w-full bg-purple-900/5 hover:bg-purple-900/10 px-4 py-3 flex items-center justify-between border-b border-purple-100/50 transition-colors"
                >
                  <span className="text-[10px] font-black uppercase text-purple-900 tracking-wider flex items-center gap-2">
                    📧 Hướng dẫn kết nối Gmail (Lịch Hẹn)
                  </span>
                  <ChevronDown className={`w-4 h-4 text-purple-700 transition-transform duration-200 ${showGuideGmail ? 'rotate-180' : ''}`} />
                </button>
                {showGuideGmail && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-700">
                    {/* Bước 1 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">1</span>
                        <span className="font-black text-purple-900">Tạo Google Cloud Project & OAuth App</span>
                      </div>
                      <ul className="pl-7 space-y-1 text-[10px] leading-relaxed text-slate-600 list-disc">
                        <li>Vào <strong>console.cloud.google.com</strong> → New Project</li>
                        <li>Bật API: <strong>Google Calendar API</strong></li>
                        <li>Vào <strong>APIs &amp; Services → Credentials → Create OAuth 2.0 Client ID</strong></li>
                        <li>Loại: <strong>Web application</strong></li>
                        <li>Thêm Redirect URI: <code className="bg-slate-100 px-1 rounded">https://developers.google.com/oauthplayground</code></li>
                        <li>Copy <strong>Client ID</strong> và <strong>Client Secret</strong></li>
                      </ul>
                    </div>
                    {/* Bước 2 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">2</span>
                        <span className="font-black text-purple-900">Lấy Refresh Token từ OAuth Playground</span>
                      </div>
                      <ul className="pl-7 space-y-1 text-[10px] leading-relaxed text-slate-600 list-disc">
                        <li>Vào <strong>developers.google.com/oauthplayground</strong></li>
                        <li>Bấm ⚙️ (cài đặt) → tích <strong>"Use your own OAuth credentials"</strong> → điền Client ID &amp; Secret</li>
                        <li>Tìm scope: <code className="bg-slate-100 px-1 rounded">https://www.googleapis.com/auth/calendar</code> → <strong>Authorize APIs</strong></li>
                        <li>Đăng nhập bằng Gmail muốn kết nối, đồng ý cấp quyền</li>
                        <li>Step 2 → bấm <strong>"Exchange authorization code for tokens"</strong></li>
                        <li>Copy giá trị <strong>refresh_token</strong> (bắt đầu bằng <code className="bg-slate-100 px-1 rounded">1//</code>)</li>
                      </ul>
                    </div>
                    {/* Bước 3 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">3</span>
                        <span className="font-black text-purple-900">Cập nhật vào Partner Hub</span>
                      </div>
                      <ul className="pl-7 space-y-1 text-[10px] leading-relaxed text-slate-600 list-disc">
                        <li>Tìm Sender Gmail ở bảng Business Senders bên dưới</li>
                        <li>Bấm nút <strong>Sửa</strong> → điền 3 trường: <strong>Client ID</strong>, <strong>Client Secret</strong>, <strong>Refresh Token</strong></li>
                        <li>Bấm <strong>Lưu thay đổi</strong></li>
                        <li>Bấm <strong>Test</strong> → hệ thống xác minh và chuyển trạng thái sang <strong>HEALTHY</strong></li>
                      </ul>
                    </div>
                    {/* Lưu ý */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">!</span>
                        <span className="font-black text-amber-800">Lưu ý quan trọng</span>
                      </div>
                      <ul className="pl-7 space-y-1 text-[10px] leading-relaxed text-amber-800 list-disc">
                        <li>Refresh Token chỉ được cấp <strong>một lần</strong> — copy ngay trước khi đóng tab Playground</li>
                        <li>Nếu Google Cloud App ở chế độ <strong>Testing</strong>, token hết hạn sau 7 ngày — cần publish app lên <strong>Production</strong></li>
                        <li>Khi cần đổi tài khoản Gmail, lặp lại từ Bước 2</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Capability Matrix */}
              <div className="mt-3 bg-white/80 border border-indigo-100 rounded-xl overflow-hidden shadow-3xs">
                <div className="bg-indigo-900/5 px-4 py-2 border-b border-indigo-100">
                  <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">Sender Capability Matrix (Ma trận Khả năng Kênh gửi)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-indigo-100 text-[11px]">
                  <div className="p-3">
                    <span className="font-bold text-slate-700 block mb-1">💬 Zalo OA</span>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 uppercase">ZNS</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 uppercase">OA Campaign</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <span className="font-bold text-slate-700 block mb-1">✉️ Resend</span>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 uppercase">Email Campaign</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <span className="font-bold text-slate-700 block mb-1">📧 Gmail <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md ml-1">Lịch Hẹn</span></span>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 uppercase">Calendar Invite</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <span className="font-bold text-slate-700 block mb-1">📱 Personal Zalo/Phone</span>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase">Sale Follow-up</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-4 border-b border-slate-50 flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base font-black text-slate-900">Business Senders</CardTitle>
                  <CardDescription className="text-xs">Tài khoản gửi tổ chức — Email, Zalo OA, SMS</CardDescription>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
                  <input
                    type="checkbox"
                    id="show-archived-checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="show-archived-checkbox" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                    Hiển thị tài khoản lưu trữ (Show archived)
                  </label>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingData ? (
                  <LoadingSkeleton rows={3} />
                ) : businessSenders.filter(s => showArchived ? true : s.status !== 'archived').length === 0 ? (
                  <EmptyState message="Chưa có Business Sender nào khớp cấu hình lọc" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                          <th className="px-6 py-4 text-left">Tên / Provider</th>
                          <th className="px-6 py-4 text-center">Kênh</th>
                          <th className="px-6 py-4 text-center">Trạng thái</th>
                          <th className="px-6 py-4 text-center">Auth</th>
                          <th className="px-6 py-4 text-center">Quota hôm nay</th>
                          <th className="px-6 py-4 text-center">Health</th>
                          <th className="px-6 py-4 text-center">Kiểm tra lần cuối</th>
                          <th className="px-6 py-4 text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {businessSenders
                          .filter(s => showArchived ? true : s.status !== 'archived')
                          .map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-all group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                  <ChannelIcon channel={s.channel || s.provider || "email"} />
                                </div>
                                <div>
                                  <p className="text-[13px] font-black text-slate-900 flex items-center gap-2">
                                    {s.name}
                                    {s.is_default && (
                                      <Badge className="bg-indigo-100 text-indigo-600 border-none text-[9px] font-black uppercase">Default</Badge>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                    {s.provider || "—"} · {s.sender_email || s.sender_name || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${
                                  s.status === "active" ? "bg-emerald-500 animate-pulse" :
                                  s.status === "archived" ? "bg-purple-500" :
                                  s.status === "pending_verification" ? "bg-blue-500 animate-pulse" :
                                  s.status === "error" ? "bg-rose-500" :
                                  "bg-slate-300"
                                }`} />
                                <span className={`text-[11px] font-black uppercase ${
                                  s.status === "active" ? "text-emerald-600" :
                                  s.status === "archived" ? "text-purple-600" :
                                  s.status === "pending_verification" ? "text-blue-600" :
                                  s.status === "error" ? "text-rose-600" :
                                  "text-slate-400"
                                }`}>
                                  {s.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">
                                {s.auth_type === "platform_secret" ? "Cấu hình hệ thống mặc định" :
                                 s.auth_type === "api_key" ? "Khóa riêng của sender này" :
                                 s.auth_type === "oauth" ? "OAuth (User Login)" : 
                                 (s.auth_type || "api_key")}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      (s.daily_usage / (s.daily_limit || 500)) > 0.85
                                        ? "bg-rose-500"
                                        : (s.daily_usage / (s.daily_limit || 500)) > 0.6
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${Math.min(100, ((s.daily_usage || 0) / (s.daily_limit || 500)) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">
                                  {s.daily_usage || 0} / {s.daily_limit || 500}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {s.status === "archived" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-wider">
                                  <Lock className="w-3.5 h-3.5" /> Sender bị khóa
                                </span>
                              ) : (
                                <HealthBadge status={s.health_status || "unknown"} provider={s.provider} lastError={s.last_error} />
                              )}
                              
                              {s.last_error && s.status !== "archived" && (
                                <p className="text-[10px] text-rose-500 font-medium mt-1 max-w-[150px] mx-auto truncate" title={s.last_error}>
                                  {s.last_error}
                                </p>
                              )}
                              
                              {(s.provider === "zalo" || s.provider === "zalo_oa") && s.status !== "archived" && (
                                <div className="mt-1.5 space-y-0.5">
                                  {s.auth_type === "platform_secret" ? (
                                    <p className="text-[9px] text-slate-500 font-bold leading-tight max-w-[150px] mx-auto">⚙️ Cấu hình hệ thống mặc định</p>
                                  ) : s.auth_type === "oauth" && s.health_status === "healthy" ? (
                                    <p className="text-[9px] text-emerald-600 font-bold leading-tight max-w-[150px] mx-auto">✅ Đã đồng bộ credential resolver</p>
                                  ) : s.auth_type === "oauth" && s.health_status !== "healthy" ? (
                                    <p className="text-[9px] text-rose-500 font-bold leading-tight max-w-[150px] mx-auto">⚠️ Cần kết nối OAuth</p>
                                  ) : (
                                    <p className="text-[9px] text-amber-600 font-bold leading-tight max-w-[150px] mx-auto">⚠️ Chưa có token OA</p>
                                  )}
                                  <p className="text-[9px] text-slate-500 font-bold leading-tight max-w-[150px] mx-auto">Chưa bật production</p>
                                </div>
                              )}
                              {s.provider === "resend" && s.auth_type === "api_key" && s.health_status === "healthy" && (
                                <p className="text-[10px] text-emerald-600 font-bold mt-1 max-w-[150px] mx-auto" title="Available for Campaigns">
                                  Available for Campaigns
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                                <Clock className="w-3 h-3" /> {relativeTime(s.last_checked_at)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                {s.status === "archived" ? (
                                  <Button
                                    id={`restore-biz-${s.id}`}
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl text-xs font-bold h-8 px-3 gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
                                    onClick={() => restoreBusinessSender(s)}
                                    disabled={togglingId === s.id}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Restore
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      id={`test-biz-${s.id}`}
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl text-xs font-bold h-8 px-3 gap-1.5 border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                                      onClick={() => testConnection(s, "business")}
                                      disabled={testingId === s.id}
                                    >
                                      {testingId === s.id ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Activity className="w-3 h-3" />
                                      )}
                                      Test / Check Health
                                    </Button>

                                    {(s.health_status === "warning" || s.health_status === "error" || s.status === "disabled") && (
                                      <Button
                                        id={`reconnect-biz-${s.id}`}
                                        size="sm"
                                        variant="outline"
                                        className="rounded-xl text-xs font-bold h-8 px-3 gap-1.5 border-amber-100 text-amber-600 hover:bg-amber-50"
                                        onClick={() => {
                                          setReconnectSender(s);
                                          setReconnectModalOpen(true);
                                        }}
                                      >
                                        <RotateCw className="w-3 h-3" />
                                        Reconnect
                                      </Button>
                                    )}

                                    <Button
                                      id={`toggle-biz-${s.id}`}
                                      size="sm"
                                      variant="outline"
                                      className={`rounded-xl text-xs font-bold h-8 px-3 gap-1.5 ${
                                        s.is_active
                                          ? "border-rose-100 text-rose-600 hover:bg-rose-50"
                                          : "border-emerald-100 text-emerald-600 hover:bg-emerald-50"
                                      }`}
                                      onClick={() => toggleBusinessSender(s)}
                                      disabled={togglingId === s.id}
                                    >
                                      {s.is_active ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                                      {s.is_active ? "Disable" : "Enable"}
                                    </Button>

                                      <Button
                                        id={`edit-biz-${s.id}`}
                                        size="sm"
                                        variant="outline"
                                        className="rounded-xl text-xs font-bold h-8 px-3 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-100"
                                        onClick={() => {
                                          if (s.provider === "resend") {
                                            setResendSenderId(s.id);
                                            setResendSenderName(s.name || s.sender_name || "");
                                            setResendSenderEmail(s.sender_email || "");
                                            setResendApiKey("");
                                            setResendModalOpen(true);
                                          } else {
                                            setEditSenderData(s);
                                            setIsEditModalOpen(true);
                                          }
                                        }}
                                        disabled={togglingId === s.id}
                                      >
                                        Sửa / Cấu hình
                                      </Button>

                                    <Button
                                      id={`archive-biz-${s.id}`}
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl text-xs font-bold h-8 px-3 gap-1.5 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                      onClick={() => archiveBusinessSender(s)}
                                      disabled={togglingId === s.id}
                                    >
                                      Archive
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── PERSONAL SENDERS TABLE ─────────────────────────────────────────── */}
        {activeTab === "personal" && (
          <div className="space-y-4">
            {/* Hướng dẫn liên kết tài khoản Personal */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-600 animate-bounce" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">Hướng dẫn vận hành dành cho nhân viên Sales</h4>
                </div>
                <Link
                  to="/settings/communication"
                  className="text-xs font-black text-emerald-700 hover:text-emerald-950 flex items-center gap-1 bg-white/80 hover:bg-white border border-emerald-200 px-3 py-1 rounded-xl shadow-3xs transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Đi đến Cài đặt liên lạc cá nhân
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-emerald-950/80">
                <div className="space-y-1 bg-white/60 p-3.5 rounded-xl border border-emerald-100/50">
                  <span className="font-bold text-emerald-900 block">📱 Tự cấu hình tài khoản</span>
                  <p className="text-[11px] leading-relaxed">Nhân viên Sale tự truy cập và cấu hình Zalo cá nhân / Số điện thoại / Email liên lạc của mình tại màn hình <strong>Cá nhân &gt; Cài đặt liên lạc</strong>.</p>
                </div>
                <div className="space-y-1 bg-white/60 p-3.5 rounded-xl border border-emerald-100/50">
                  <span className="font-bold text-emerald-900 block">🔗 Cơ chế Smart Routing</span>
                  <p className="text-[11px] leading-relaxed">Hệ thống tự động ưu tiên sử dụng tài khoản cá nhân của chính nhân viên phụ trách khách hàng (<code>owner_sale</code> / <code>owner_tele</code>) để gửi tin follow-up.</p>
                </div>
                <div className="space-y-1 bg-white/60 p-3.5 rounded-xl border border-emerald-100/50">
                  <span className="font-bold text-emerald-900 block">🛡️ Quyền hạn của Admin</span>
                  <p className="text-[11px] leading-relaxed">Admin/SubAdmin chỉ thực hiện vai trò giám sát trạng thái hoạt động (health, active status) của các tài khoản gửi cá nhân, hoàn toàn không xem được mã bí mật (secret/token).</p>
                </div>

                {/* === Card 4: Gmail App Password Guide === */}
                <div className="col-span-1 md:col-span-3 bg-white/60 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                  <button type="button" onClick={() => setShowGuideGmail(v => !v)} className="w-full flex items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-emerald-900 block">&#128231; Huong dan them Gmail ca nhan &amp; lay Mat khau ung dung (App Password)</span>
                      <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">Bat buoc neu dung Email</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-emerald-600 flex-shrink-0 transition-transform duration-200 ${showGuideGmail ? "rotate-180" : ""}`} />
                  </button>
                  <p className="text-[11px] leading-relaxed text-emerald-800">Gmail yeu cau <strong>Mat khau ung dung (App Password)</strong> thay vi mat khau thuong khi dung voi ung dung ben thu 3. Bam de xem chi tiet.</p>
                  {showGuideGmail && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">1</span><span className="text-[11px] font-black text-emerald-900">Bat Xac minh 2 buoc (2FA)</span></div>
                          <p className="text-[10px] text-emerald-800 leading-relaxed pl-5">Vao <strong>myaccount.google.com</strong> → <em>Bao mat</em> → <em>Xac minh 2 buoc</em> → Bat len. Bat buoc truoc khi tao App Password.</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">2</span><span className="text-[11px] font-black text-emerald-900">Tao App Password</span></div>
                          <p className="text-[10px] text-emerald-800 leading-relaxed pl-5">Vao <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-bold text-emerald-700">myaccount.google.com/apppasswords</a> → Chon <em>Mail</em> → Bam <strong>Tao</strong>.</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">3</span><span className="text-[11px] font-black text-emerald-900">Copy ma 16 ky tu</span></div>
                          <p className="text-[10px] text-emerald-800 leading-relaxed pl-5">Google hien ma dang <code className="bg-white px-1 rounded font-mono text-[9px]">abcd efgh ijkl mnop</code>. Sao chep ngay — chi hien <strong>1 lan duy nhat</strong>.</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">4</span><span className="text-[11px] font-black text-emerald-900">Dan vao Partner Hub</span></div>
                          <p className="text-[10px] text-emerald-800 leading-relaxed pl-5">Bam <strong>"Di den Cai dat lien lac ca nhan"</strong> → kenh <em>Email</em> → dien Gmail + dan ma → <strong>Them Tai Khoan</strong>.</p>
                        </div>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex gap-2 items-start">
                        <span className="text-xs flex-shrink-0">&#9888;&#65039;</span>
                        <ul className="text-[10px] text-amber-800 list-disc pl-2 space-y-0.5 leading-relaxed">
                          <li>He thong tu gioi han <strong>50 email/chien dich</strong> de tranh Google khoa tai khoan.</li>
                          <li>App Password khac mat khau Gmail that — an toan khi dung voi he thong.</li>
                          <li>Neu chua cau hinh, chien dich tu <strong>fallback sang Business Sender</strong> — khong bo lo khach hang.</li>
                          <li>Thu hoi bat cu luc: Google Account → Mat khau ung dung → <strong>Thu hoi</strong>.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-4 border-b border-slate-50">
                <CardTitle className="text-base font-black text-slate-900">Personal Senders</CardTitle>
                <CardDescription className="text-xs">Tài khoản cá nhân của nhân viên — Zalo, Email, Phone</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingData ? (
                  <LoadingSkeleton rows={5} />
                ) : personalSenders.length === 0 ? (
                  <EmptyState message="Chưa có nhân viên nào cấu hình tài khoản cá nhân" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                          <th className="px-6 py-4 text-left">Nhân viên</th>
                          <th className="px-6 py-4 text-center">Kênh</th>
                          <th className="px-6 py-4 text-center">Tên tài khoản</th>
                          <th className="px-6 py-4 text-center">Trạng thái</th>
                          <th className="px-6 py-4 text-center">Health</th>
                          <th className="px-6 py-4 text-center">Xác thực lần cuối</th>
                          <th className="px-6 py-4 text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {personalSenders.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-sm">
                                  {(a.staff_name || "?")[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-[13px] font-black text-slate-900">{a.staff_name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                    {a.staff_role} · {a.staff_email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <ChannelIcon channel={a.platform} />
                                <Badge variant="outline" className="text-[10px] font-bold uppercase bg-slate-50 text-slate-600 border-slate-100">
                                  {a.platform}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-[12px] font-bold text-slate-700">
                                {a.account_name || "—"}
                              </span>
                              {a.account_identifier && (
                                <p className="text-[10px] text-slate-400 mt-0.5">{a.account_identifier}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${a.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                                <span className={`text-[11px] font-black uppercase ${a.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                                  {a.is_active ? "Active" : "Disabled"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <HealthBadge status={a.health_status || "unknown"} />
                              {a.last_error && (
                                <p className="text-[10px] text-rose-500 font-medium mt-1 max-w-[150px] mx-auto truncate" title={a.last_error}>
                                  {a.last_error}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                                <Clock className="w-3 h-3" /> {relativeTime(a.last_verified_at)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  id={`test-personal-${a.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl text-xs font-bold h-8 px-3 gap-1.5 border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                                  onClick={() => testConnection(a.id, "personal")}
                                  disabled={testingId === a.id}
                                >
                                  {testingId === a.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                                  Test
                                </Button>
                                <Button
                                  id={`reconnect-${a.id}`}
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl text-xs font-bold h-8 px-3 gap-1.5 border-amber-100 text-amber-600 hover:bg-amber-50"
                                  onClick={() => markReconnect(a)}
                                  disabled={togglingId === a.id}
                                >
                                  <RotateCcw className="w-3 h-3" /> Reconnect
                                </Button>
                                <Button
                                  id={`toggle-personal-${a.id}`}
                                  size="sm"
                                  variant="outline"
                                  className={`rounded-xl text-xs font-bold h-8 px-3 gap-1.5 ${
                                    a.is_active
                                      ? "border-rose-100 text-rose-600 hover:bg-rose-50"
                                      : "border-emerald-100 text-emerald-600 hover:bg-emerald-50"
                                  }`}
                                  onClick={() => togglePersonalSender(a)}
                                  disabled={togglingId === a.id}
                                >
                                  {a.is_active ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── AUDIT LOGS ──────────────────────────────────────────────────────── */}
        {activeTab === "logs" && (
          <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-50">
              <CardTitle className="text-base font-black text-slate-900">Audit Log</CardTitle>
              <CardDescription className="text-xs">50 hành động gần nhất của Admin trên Sender Accounts</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingData ? (
                <LoadingSkeleton rows={5} />
              ) : auditLogs.length === 0 ? (
                <EmptyState message="Chưa có hành động nào được ghi nhận" />
              ) : (
                <div className="divide-y divide-slate-50">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-all">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        log.result === "healthy" || log.result === "ok" ? "bg-emerald-50" :
                        log.result === "warning" ? "bg-amber-50" : "bg-rose-50"
                      }`}>
                        {log.result === "healthy" || log.result === "ok"
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          : log.result === "warning"
                          ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                          : <XCircle className="w-4 h-4 text-rose-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-black uppercase">
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                          <Badge className="bg-indigo-50 text-indigo-600 border-none text-[10px] font-black uppercase">
                            {log.sender_type}
                          </Badge>
                        </div>
                        <p className="text-[12px] text-slate-600 font-medium mt-1 truncate">{log.note || "—"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[11px] text-slate-400 font-medium">{relativeTime(log.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── DELIVERY LOGS TABLE (ENHANCED) ────────────────────────────────────── */}
        {activeTab === "delivery_logs" && (() => {
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const logsToday = deliveryLogs.filter(l => new Date(l.created_at) >= todayStart);
          const sentToday = logsToday.filter(l => l.status === "sent" || l.status === "copied").length;
          const failedToday = logsToday.filter(l => l.status === "failed").length;
          const blockedToday = logsToday.filter(l => l.status === "blocked" || l.status === "duplicate_blocked").length;
          const retryPending = retryQueue.filter(r => r.status === "pending").length;
          const dupBlocked = deliveryLogs.filter(l => l.status === "duplicate_blocked").length;

          // Filter logic
          const filtered = deliveryLogs.filter(log => {
            if (filterChannel !== "all" && log.channel !== filterChannel) return false;
            if (filterStatus !== "all" && log.status !== filterStatus) return false;
            if (filterSender !== "all" && log.sender_account_id !== filterSender) return false;
            if (filterErrorCode !== "all" && log.normalized_error_code !== filterErrorCode) return false;
            return true;
          });

          return (
          <div className="space-y-4">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Sent Today", value: sentToday, color: "text-emerald-700", bg: "bg-emerald-50" },
                { label: "Failed Today", value: failedToday, color: "text-rose-700", bg: "bg-rose-50" },
                { label: "Blocked Today", value: blockedToday, color: "text-amber-700", bg: "bg-amber-50" },
                { label: "Retry Pending", value: retryPending, color: "text-blue-700", bg: "bg-blue-50" },
                { label: "Duplicate Blocked", value: dupBlocked, color: "text-purple-700", bg: "bg-purple-50" },
              ].map(kpi => (
                <div key={kpi.label} className={`rounded-2xl p-4 ${kpi.bg} flex flex-col`}>
                  <span className="text-2xl font-black font-mono">{kpi.value}</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider mt-1 ${kpi.color}`}>{kpi.label}</span>
                </div>
              ))}
            </div>

            {/* Filters */}
            <Card className="rounded-2xl border-none shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <ListFilter className="w-4 h-4 text-slate-400 shrink-0" />
                  <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
                    className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700 bg-white">
                    <option value="all">Tất cả kênh</option>
                    <option value="zns">ZNS</option>
                    <option value="email">Email</option>
                    <option value="zalo">Zalo</option>
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700 bg-white">
                    <option value="all">Tất cả trạng thái</option>
                    {["sent","failed","blocked","retrying","abandoned","duplicate_blocked","copied","prepared"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select value={filterSender} onChange={e => setFilterSender(e.target.value)}
                    className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700 bg-white">
                    <option value="all">Tất cả sender</option>
                    {businessSenders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={filterErrorCode} onChange={e => setFilterErrorCode(e.target.value)}
                    className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700 bg-white">
                    <option value="all">Tất cả error code</option>
                    {Object.entries(ERROR_CODE_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => { setFilterChannel("all"); setFilterStatus("all"); setFilterSender("all"); setFilterErrorCode("all"); }}
                    className="text-xs text-slate-500 h-8 rounded-xl">
                    <RefreshCcw className="w-3 h-3 mr-1" /> Reset
                  </Button>
                  <span className="ml-auto text-[10px] text-slate-400 font-bold">{filtered.length} kết quả</span>
                </div>
              </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
              <CardContent className="p-0">
                {loadingData ? (
                  <LoadingSkeleton rows={5} />
                ) : filtered.length === 0 ? (
                  <EmptyState message="Không có log nào khớp với bộ lọc" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                          <th className="px-5 py-4 text-left">Thời gian</th>
                          <th className="px-5 py-4 text-left">Khách hàng</th>
                          <th className="px-5 py-4 text-center">Kênh</th>
                          <th className="px-5 py-4 text-center">Trạng thái</th>
                          <th className="px-5 py-4 text-left">Error Code</th>
                          <th className="px-5 py-4 text-center">Retry</th>
                          <th className="px-5 py-4 text-left">Sender</th>
                          <th className="px-5 py-4 text-left">Người thực hiện</th>
                          <th className="px-5 py-4 text-center">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filtered.map((log) => {
                          const errorCode = log.normalized_error_code;
                          const statusColorClass = STATUS_COLORS[log.status] || "text-slate-600 bg-slate-100";
                          const errorLabel = errorCode ? (ERROR_CODE_LABELS[errorCode as ZnsErrorCode] || errorCode) : null;
                          return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => setSelectedLog(log)}>
                            <td className="px-5 py-4 whitespace-nowrap text-xs font-mono text-slate-500">
                              {new Date(log.created_at).toLocaleString("vi-VN")}
                            </td>
                            <td className="px-5 py-4">
                              {log.customers ? (
                                <div>
                                  <p className="text-[12px] font-bold text-slate-800">{log.customers.business_name || log.customers.name}</p>
                                  {log.customers.business_name && log.customers.name && (
                                    <p className="text-[10px] text-slate-400">{log.customers.name}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Chưa rõ</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <Badge variant="outline" className="text-[9px] font-bold uppercase bg-slate-50 text-slate-600 border-slate-100">
                                {log.channel}
                              </Badge>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusColorClass}`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              {errorLabel ? (
                                <span className="text-[10px] font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg">
                                  {errorCode}
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="text-xs font-bold text-slate-500">
                                {log.retry_count ?? 0}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                              {log.sender_name}
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-xs text-slate-500 font-medium">{log.operator_name}</p>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <Button variant="ghost" size="sm"
                                onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                                className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          );
        })()}

        {/* ── RETRY QUEUE TAB ──────────────────────────────────────────────── */}
        {activeTab === "retry_queue" && (
          <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-slate-900">Marketing Retry Queue</CardTitle>
                <CardDescription className="text-xs">Danh sách tin nhắn chờ gửi lại do lỗi tạm thời</CardDescription>
              </div>
              <Button
                onClick={async () => {
                  setProcessingRetry(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-marketing-retry`,
                      { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" }, body: "{}" }
                    );
                    const json = await res.json();
                    if (json.success) {
                      toast.success(`Đã xử lý ${json.processed} retry thành công`);
                      fetchData();
                    } else toast.error("Lỗi: " + json.error);
                  } catch (e: any) { toast.error(e.message); }
                  finally { setProcessingRetry(false); }
                }}
                disabled={processingRetry || retryQueue.filter(r => r.status === "pending").length === 0}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold gap-2"
              >
                {processingRetry ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                Process Retry Queue
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loadingData ? (
                <LoadingSkeleton rows={3} />
              ) : retryQueue.length === 0 ? (
                <EmptyState message="Không có tin nhắn nào đang chờ gửi lại" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Khách hàng</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Template</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Lẽ do</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Retry lần</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Trạng thái</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Lần sau</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {retryQueue.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm font-bold text-slate-800">{(r.customer as any)?.name || "—"}</td>
                          <td className="px-6 py-4 text-xs text-slate-600">{(r.template as any)?.template_name || "—"}</td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">
                              {r.normalized_error_code || r.retry_reason || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-700">{r.retry_count}/{r.max_retries}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                              r.status === "pending" ? "bg-amber-50 text-amber-700" :
                              r.status === "retrying" ? "bg-blue-50 text-blue-700" :
                              "bg-rose-100 text-rose-800"
                            }`}>{r.status}</span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-500">
                            {r.next_retry_at ? new Date(r.next_retry_at).toLocaleString("vi-VN") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {/* ── ZNS TEMPLATES TAB ──────────────────────────────────────────────── */}
        {activeTab === "zns_templates" && (
          <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-slate-900">ZNS Templates (Registry)</CardTitle>
                <CardDescription className="text-xs">Quản lý các mẫu tin nhắn Zalo Notification Service đã duyệt</CardDescription>
              </div>
              <Button 
                onClick={() => {
                  setEditingZnsTemplate(null);
                  setZnsTemplateModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-2"
              >
                <Plus className="w-4 h-4" /> Thêm Template
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loadingData ? (
                <LoadingSkeleton rows={3} />
              ) : znsTemplates.length === 0 ? (
                <EmptyState message="Chưa có ZNS Template nào. Hãy thêm từ Zalo OA Developer." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Tên Template / ID</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Zalo OA Sender</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Loại (Purpose)</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Tham số (Params)</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider">Trạng thái</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {znsTemplates.map((t) => {
                        const sender = businessSenders.find(s => s.id === t.sender_account_id);
                        return (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 align-top">
                              <p className="text-sm font-bold text-slate-800">{t.template_name}</p>
                              <p className="text-xs font-mono text-slate-500 mt-1">ID: {t.zalo_template_id}</p>
                            </td>
                            <td className="px-6 py-4 align-top">
                              <p className="text-xs font-bold text-slate-700">{sender?.name || "Không tìm thấy"}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-1">{t.sender_account_id.slice(0, 8)}...</p>
                            </td>
                            <td className="px-6 py-4 align-top">
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {t.purpose || "Chưa phân loại"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 align-top">
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {t.required_params && Array.isArray(t.required_params) ? t.required_params.map((p: string) => (
                                  <Badge key={p} className="bg-slate-100 text-slate-600 border-none text-[9px] font-mono hover:bg-slate-200">
                                    {p}
                                  </Badge>
                                )) : <span className="text-xs text-slate-400">Không có</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 align-top">
                              {t.is_active ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-none text-[10px]">Đang hoạt động</Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-500 border-none text-[10px]">Đã tắt</Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 align-top text-right space-x-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setTestingZnsTemplate(t);
                                  setZnsTestSendModalOpen(true);
                                }}
                                disabled={!t.is_active}
                                className="h-8 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              >
                                <Send className="w-3 h-3 mr-1" /> Test Send
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setEditingZnsTemplate(t);
                                  setZnsTemplateModalOpen(true);
                                }}
                                className="h-8 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              >
                                Chỉnh sửa
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </main>

      {/* ── RESEND CONFIG MODAL ── */}
      {resendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-black">Cấu hình Resend Email</h2>
                    <p className="text-[11px] text-indigo-100 font-medium">Bảo mật API Key - Token lưu ở server</p>
                  </div>
                </div>
                <button
                  onClick={() => setResendModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tên hiển thị</Label>
                <Input
                  placeholder="Ví dụ: Info Desembre"
                  value={resendSenderName}
                  onChange={(e) => setResendSenderName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">From Email</Label>
                <Input
                  placeholder="Ví dụ: info@desembre-vn.com"
                  value={resendSenderEmail}
                  onChange={(e) => setResendSenderEmail(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resend API Key (Bảo mật)</Label>
                <Input
                  type="password"
                  placeholder="Bắt đầu bằng re_..."
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  className="rounded-xl font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Khóa sẽ được mã hóa AES-GCM tại server. Nhập khóa mới để ghi đè khóa cũ, hoặc để trống nếu chỉ muốn sửa Tên/Email.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setResendModalOpen(false)}
                  className="flex-1 rounded-xl h-10 font-bold text-sm border-slate-200"
                  disabled={resendConfiguring}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleConfigureResend}
                  className="flex-1 rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md"
                  disabled={resendConfiguring}
                >
                  {resendConfiguring ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang lưu...</>
                  ) : (
                    "Lưu Cấu Hình"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ZALO OA CONNECT MODAL ─────────────────────────────────────── */}
      {zaloModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black">Kết nối Zalo OA</h2>
                    <p className="text-[11px] text-blue-100 font-medium">OAuth 2.0 PKCE — Token lưu server-side an toàn</p>
                  </div>
                </div>
                <button
                  onClick={() => setZaloModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Security notice */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 font-medium space-y-1">
                <p className="font-black text-blue-800 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Quy trình bảo mật
                </p>
                <p>• Không cần nhập Access Token thô tại đây.</p>
                <p>• Token được mã hóa AES-GCM và chỉ lưu server-side.</p>
                <p>• Bạn sẽ được chuyển hướng sang trang phân quyền Zalo.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Tên cấu hình Sender <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="zalo-sender-name"
                  value={zaloSenderName}
                  onChange={(e) => setZaloSenderName(e.target.value)}
                  placeholder="vd: Zalo OA Desembre Official"
                  className="h-10 rounded-xl border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Zalo App ID <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="zalo-app-id"
                  value={zaloAppId}
                  onChange={(e) => setZaloAppId(e.target.value)}
                  placeholder="vd: 4827301823049"
                  className="h-10 rounded-xl border-slate-200 text-sm font-mono"
                />
                <p className="text-[10px] text-slate-400">Lấy từ Zalo Developers Console → App ID</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Zalo OA ID <span className="text-slate-400 font-normal">(không bắt buộc)</span>
                </Label>
                <Input
                  id="zalo-oa-id"
                  value={zaloOaId}
                  onChange={(e) => setZaloOaId(e.target.value)}
                  placeholder="vd: 482930192830291"
                  className="h-10 rounded-xl border-slate-200 text-sm font-mono"
                />
                <p className="text-[10px] text-slate-400">Tùy chọn — hệ thống sẽ tự động lấy OA ID sau khi kết nối</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setZaloModalOpen(false)}
                  className="flex-1 rounded-xl h-10 font-bold text-sm border-slate-200"
                  disabled={zaloConnecting}
                >
                  Hủy
                </Button>
                <Button
                  id="btn-zalo-oauth-confirm"
                  onClick={handleStartZaloOAuth}
                  disabled={zaloConnecting || !zaloSenderName.trim() || !zaloAppId.trim()}
                  className="flex-1 rounded-xl h-10 font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  {zaloConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      Kết nối qua Zalo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ZNS TEMPLATE DIALOG ────────────────────────────────────────── */}
      <ZnsTemplateDialog 
        open={znsTemplateModalOpen} 
        onOpenChange={setZnsTemplateModalOpen}
        templateToEdit={editingZnsTemplate}
        businessSenders={businessSenders}
        onSuccess={fetchData}
      />
      
      {/* ── ZNS TEST SEND DIALOG ───────────────────────────────────────── */}
      <ZnsTestSendDialog
        open={znsTestSendModalOpen}
        onOpenChange={setZnsTestSendModalOpen}
        template={testingZnsTemplate}
      />

      {/* ── ADD SENDER WIZARD ──────────────────────────────────────────── */}
      <AddSenderWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={fetchData}
      />

      {/* ── RECONNECT DIALOG ───────────────────────────────────────────── */}
      {reconnectModalOpen && reconnectSender && (
        <Dialog open={reconnectModalOpen} onOpenChange={setReconnectModalOpen}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 border-none shadow-2xl">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                🔄 Reconnect: {reconnectSender.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Khôi phục hoặc cập nhật kết nối cho tài khoản gửi tin nhắn
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Resend reconnect details */}
              {(reconnectSender.provider === "resend" || reconnectSender.provider === "email") && (
                <div className="space-y-3 text-xs text-slate-600">
                  <p className="leading-relaxed">
                    Kênh gửi <strong>Resend Email</strong> được cấu hình bảo mật. Để cập nhật hoặc sửa kết nối:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed font-medium">
                    <li>Đảm bảo API Key hợp lệ và tên miền gửi thư đã được xác thực trên Resend.</li>
                    <li>Cập nhật biến môi trường <code>RESEND_API_KEY</code> trong cấu hình Edge Secrets ở bảng điều khiển của dự án Supabase.</li>
                    <li>Sau khi cập nhật, bấm nút <strong>Chạy Test Connection</strong> bên dưới để hệ thống cập nhật sức khỏe tài khoản về <code>Healthy</code>.</li>
                  </ol>
                </div>
              )}

              {/* Gmail/Google reconnect details */}
              {(reconnectSender.provider === "gmail/google" || reconnectSender.provider === "google_calendar") && (
                <div className="space-y-3 text-xs text-slate-600">
                  <p className="leading-relaxed">
                    Kênh gửi <strong>Gmail / Google</strong> yêu cầu gia hạn uỷ quyền hoặc kiểm tra bộ khóa:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed font-medium">
                    <li>Kiểm tra xem Client ID, Client Secret và Refresh Token của tiền tố <code>{reconnectSender.secret_prefix || "GOOGLE_DEFAULT"}</code> trong Edge Secrets có bị thu hồi hay không.</li>
                    <li>Gmail reconnect hiện đang cần technical OAuth/Edge Secret setup. Hãy chắc chắn các biến cấu hình được thiết lập chính xác trên server.</li>
                    <li>Nhấn nút <strong>Chạy Test Connection</strong> để gửi probe kiểm tra token refresh và cập nhật trạng thái sức khỏe.</li>
                  </ol>
                </div>
              )}

              {/* Zalo OA reconnect details */}
              {(reconnectSender.provider === "zalo" || reconnectSender.provider === "zalo_oa") && (
                <div className="space-y-3 text-xs text-slate-600">
                  <p className="leading-relaxed">
                    Để kết nối lại <strong>Zalo OA</strong>, hệ thống sẽ thực hiện khởi chạy lại luồng xin quyền ủy thác OAuth 2.0.
                  </p>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 font-medium space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> Chú ý bảo mật
                    </p>
                    <p>• Mã thông báo cũ sẽ bị ghi đè hoàn toàn bằng mã mới sau khi uỷ quyền thành công.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setReconnectSender(null);
                  setReconnectModalOpen(false);
                }}
                className="flex-1 rounded-xl text-xs font-bold h-10"
              >
                Hủy / Đóng
              </Button>

              {(reconnectSender.provider === "zalo" || reconnectSender.provider === "zalo_oa") ? (
                <Button
                  onClick={async () => {
                    const sName = reconnectSender.name;
                    const appId = prompt("Nhập Zalo App ID để kết nối lại:", "482938192039281");
                    if (!appId) return;
                    
                    setReconnectModalOpen(false);
                    setSubmitting(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session?.access_token) throw new Error("Không tìm thấy session");

                      const res = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zalo-oauth-start`,
                        {
                          method: "POST",
                          headers: {
                            "Authorization": `Bearer ${session.access_token}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            sender_name: sName,
                            app_id: appId.trim(),
                            redirect_uri: window.location.origin + "/admin/sender-accounts",
                          }),
                        },
                      );

                      const json = await res.json();
                      if (!res.ok || !json.oauth_url) {
                        throw new Error(json.error || "Không nhận được OAuth URL");
                      }

                      toast.success("Đang chuyển hướng sang Zalo...");
                      window.location.href = json.oauth_url;
                    } catch (e: any) {
                      toast.error("Lỗi: " + e.message);
                      setSubmitting(false);
                    }
                  }}
                  className="flex-1 rounded-xl text-xs font-bold h-10 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Bắt đầu Zalo OAuth
                </Button>
              ) : (
                <Button
                  onClick={async () => {
                    setReconnectModalOpen(false);
                    await testConnection(reconnectSender.id, "business");
                  }}
                  className="flex-1 rounded-xl text-xs font-bold h-10 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Chạy Test Connection
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── DELIVERY LOG DETAIL DRAWER ──────────────────────────────────── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-sm font-black text-slate-900">Delivery Log Detail</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)} className="h-8 w-8 p-0 rounded-lg">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Channel */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase ${STATUS_COLORS[selectedLog.status] || "bg-slate-100 text-slate-600"}`}>
                  {selectedLog.status}
                </span>
                <Badge variant="outline" className="text-[10px] font-bold uppercase">
                  {selectedLog.channel}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-bold uppercase">
                  {selectedLog.mode}
                </Badge>
              </div>

              {/* Key Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "ID", value: selectedLog.id.slice(0, 8) + "…" },
                  { label: "Thời gian", value: new Date(selectedLog.created_at).toLocaleString("vi-VN") },
                  { label: "Khách hàng", value: selectedLog.customers?.business_name || selectedLog.customers?.name || "—" },
                  { label: "Sender", value: selectedLog.sender_name || "—" },
                  { label: "Người thực hiện", value: selectedLog.operator_name || "—" },
                  { label: "Provider Message ID", value: selectedLog.provider_message_id || "—" },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{item.label}</p>
                    <p className="text-xs font-bold text-slate-800 mt-1 break-all">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Error Info */}
              {selectedLog.normalized_error_code && (
                <div className="bg-rose-50 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase text-rose-600 tracking-wider">Error Details</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-lg">
                      {selectedLog.normalized_error_code}
                    </span>
                    <span className="text-xs text-rose-700">
                      {ERROR_CODE_LABELS[selectedLog.normalized_error_code as ZnsErrorCode] || ""}
                    </span>
                  </div>
                  {selectedLog.reason && (
                    <p className="text-xs text-rose-700 font-medium">{selectedLog.reason}</p>
                  )}
                </div>
              )}

              {/* Dedupe & Retry */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Dedupe & Retry</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Dedupe Key</span>
                    <span className="font-mono text-slate-700 text-[10px]">{selectedLog.dedupe_key || "—"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Retry Count</span>
                    <span className="font-bold text-slate-700">{selectedLog.retry_count ?? 0}</span>
                  </div>
                  {selectedLog.last_retry_at && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Last Retry</span>
                      <span className="text-slate-700">{new Date(selectedLog.last_retry_at).toLocaleString("vi-VN")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Provider Response */}
              {selectedLog.provider_response && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Provider Response</p>
                  <pre className="bg-slate-900 text-emerald-400 rounded-xl p-4 text-[10px] font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.provider_response, null, 2)}
                  </pre>
                </div>
              )}

              {/* Delivery Metadata */}
              {selectedLog.delivery_metadata && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Delivery Metadata</p>
                  <pre className="bg-slate-900 text-sky-400 rounded-xl p-4 text-[10px] font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.delivery_metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Campaign Link */}
              {selectedLog.marketing_campaigns && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Campaign:</span>
                  <span className="text-indigo-600 font-bold">{selectedLog.marketing_campaigns.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Sender Modal ──────────────────────────────────────────────── */}
      <EditSenderModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        sender={editSenderData}
        onSuccess={fetchData}
      />
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-500 shadow-emerald-200",
    rose: "from-rose-500 to-pink-500 shadow-rose-200",
    indigo: "from-indigo-500 to-violet-500 shadow-indigo-200",
    amber: "from-amber-500 to-orange-500 shadow-amber-200",
  };
  const bg = colorMap[color] || colorMap.indigo;
  return (
    <div className={`bg-gradient-to-br ${bg} rounded-2xl p-5 text-white shadow-lg`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <h3 className="text-4xl font-black mt-2 tracking-tighter">{value}</h3>
    </div>
  );
}

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-slate-50 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-5 flex items-center gap-4">
          <div className="w-9 h-9 bg-slate-100 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-100 rounded w-1/3" />
            <div className="h-2.5 bg-slate-100 rounded w-1/2" />
          </div>
          <div className="h-6 w-16 bg-slate-100 rounded-lg" />
          <div className="h-6 w-16 bg-slate-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-20 flex flex-col items-center gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Users className="w-7 h-7 text-slate-300" />
      </div>
      <p className="text-sm font-bold text-slate-400">{message}</p>
    </div>
  );
}
