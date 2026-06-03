/* eslint-disable */
import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ResendProcessorPanel } from "@/components/admin/ResendProcessorPanel";
import { ZaloProcessorPanel } from "@/components/admin/ZaloProcessorPanel";
import {
  Lock,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  Inbox,
  Radio,
  DatabaseZap,
  Zap,
  Bot,
  ExternalLink,
  Loader2,
  Clock,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/operations")({
  component: AdminOperations,
});

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface OpsStatus {
  resend_worker_enabled: boolean;
  zalo_worker_enabled: boolean;
  marketing_production_sending_enabled: boolean;
  marketing_provider_mode: string;
  zalo_production_status: string;
  cron_scheduler_status: string;
}

interface OpsCounts {
  pending_resend_events: number;
  pending_zalo_delivery_events: number;
  inbound_zalo_events: number;
  failed_webhook_events: number;
  active_email_suppressions: number;
  healthy_sender_count: number;
  error_sender_count: number;
}

interface OpsTimestamps {
  latest_webhook_received_at: string | null;
  last_delivery_log_at: string | null;
}

interface OpsData {
  status: OpsStatus;
  counts: OpsCounts;
  timestamps: OpsTimestamps;
  message: string;
}

/* ─── Helper components ──────────────────────────────────────────────────── */

function StatusBadge({
  value,
  trueLabel = "Đang bật",
  falseLabel = "Đang tắt",
  dangerOnTrue = false,
  dangerOnFalse = false,
  neutralOnFalse = false,
}: {
  value: boolean | string | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
  dangerOnTrue?: boolean;
  dangerOnFalse?: boolean;
  neutralOnFalse?: boolean;
}) {
  if (value === null || value === undefined) {
    return (
      <Badge
        variant="outline"
        className="bg-slate-50 border-slate-300 text-slate-500 font-semibold gap-1 text-xs"
      >
        <HelpCircle className="w-3 h-3" /> Chưa xác minh
      </Badge>
    );
  }
  if (typeof value === "boolean") {
    if (value) {
      return (
        <Badge
          variant="outline"
          className={`${dangerOnTrue ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-emerald-50 border-emerald-300 text-emerald-700"} font-bold gap-1 text-xs`}
        >
          {dangerOnTrue ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}{" "}
          {trueLabel}
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="outline"
          className={`${neutralOnFalse ? "bg-slate-50 border-slate-300 text-slate-500" : dangerOnFalse ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-emerald-50 border-emerald-300 text-emerald-700"} font-bold gap-1 text-xs`}
        >
          {neutralOnFalse ? (
            <XCircle className="w-3 h-3" />
          ) : dangerOnFalse ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <Lock className="w-3 h-3" />
          )}{" "}
          {falseLabel}
        </Badge>
      );
    }
  }
  return (
    <Badge
      variant="outline"
      className="bg-slate-50 border-slate-200 text-slate-700 font-semibold text-xs"
    >
      {String(value)}
    </Badge>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

function AdminOperations() {
  const { isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  const [opsData, setOpsData] = useState<OpsData | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchOpsStatus = useCallback(async () => {
    setOpsLoading(true);
    setOpsError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("No session token");

      const url = `${(supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-ops-status`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOpsData(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setOpsError(err.message);
    } finally {
      setOpsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin || isSubAdmin) fetchOpsStatus();
  }, [isAdmin, isSubAdmin, fetchOpsStatus]);

  const handleCopyStatus = () => {
    if (!opsData) return;
    const { status: s, counts: c, timestamps: t } = opsData;
    const report = `**Operations Control Diagnostic Report**
_Generated at: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}_

**1. Safety Status**
- Marketing Production Sending: ${s.marketing_production_sending_enabled ? "ENABLED" : "LOCKED"}
- Resend Webhook Worker: ${s.resend_worker_enabled ? "ENABLED" : "DISABLED"}
- Cron Scheduler: ${s.cron_scheduler_status}
- Zalo Production: ${s.zalo_production_status}
- Provider Mode: ${s.marketing_provider_mode}

**2. Workload & Health**
- Pending Resend Webhook Events: ${c.pending_resend_events}
- Pending Zalo Delivery Webhook Events: ${c.pending_zalo_delivery_events}
- Inbound Zalo Events (Preserved): ${c.inbound_zalo_events}
- Failed Webhook Events: ${c.failed_webhook_events}
- Active Suppressions: ${c.active_email_suppressions}
- Healthy Senders: ${c.healthy_sender_count}
- Error Senders: ${c.error_sender_count}
- Latest Webhook Received: ${t.latest_webhook_received_at || "N/A"}

Note: Inbound Zalo events are preserved for future Inbox/Automation.`;

    navigator.clipboard.writeText(report);
    toast.success("Đã copy báo cáo trạng thái", {
      description: "Bạn có thể dán vào ticket hoặc chat.",
    });
  };

  /* ─── Auth guard ────────────────────────────────────────────────────── */

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );

  if (!isAdmin && !isSubAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">
          Trang Operations Control chỉ dành cho Admin.
        </p>
        <Link
          to="/workspace"
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
        >
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  const s = opsData?.status;
  const c = opsData?.counts;
  const t = opsData?.timestamps;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 pb-20 font-sans antialiased">
      <div className="max-w-[1200px] mx-auto space-y-6">
        {/* ── Header ── */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/admin/hub"
              className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              ← Admin Hub
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-violet-500" />
                Operations Control
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Quan sát và kiểm soát thủ công hệ thống vận hành CRM
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
              {lastRefreshed && (
                <span className="text-xs text-slate-400 flex items-center gap-1 mr-auto sm:mr-0 shrink-0">
                  <Clock className="w-3 h-3" />
                  Làm mới lúc {format(lastRefreshed, "HH:mm:ss")}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyStatus}
                disabled={opsLoading || !opsData}
                className="h-9 rounded-lg gap-1.5 text-slate-600 text-xs shrink-0"
              >
                <Copy className="w-4 h-4" />
                Copy Ops Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchOpsStatus}
                disabled={opsLoading}
                className="h-9 rounded-lg gap-1.5 text-slate-600 text-xs shrink-0"
              >
                {opsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Làm mới
              </Button>
            </div>
          </div>
        </div>

        {/* ── Safety Banner ── */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3 items-start">
          <ShieldAlert className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
          <p className="text-violet-700 text-xs leading-relaxed">
            <strong>Operations Control</strong> là màn hình quan sát và chạy thủ công có kiểm soát.{" "}
            Không bật production sending, không bật automation, không sửa secrets từ màn này.
          </p>
        </div>

        {/* ── API Error ── */}
        {opsError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-rose-700 text-sm font-semibold">Không tải được dữ liệu vận hành</p>
              <p className="text-rose-600 text-xs mt-1">{opsError}</p>
            </div>
          </div>
        )}

        {/* ── 1. System Safety Overview ── */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardHeader className="pb-3 border-b border-slate-100">
            <SectionHeader
              icon={<ShieldAlert className="w-5 h-5 text-violet-500" />}
              title="System Safety Overview"
              description="Trạng thái an toàn hệ thống — đọc từ ENV và DB (read-only)"
            />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Marketing Production Sending */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                    Marketing Production Sending
                  </div>
                  {opsLoading ? (
                    <div className="h-6 bg-slate-200 rounded animate-pulse w-24" />
                  ) : s ? (
                    <StatusBadge
                      value={s.marketing_production_sending_enabled}
                      trueLabel="Đang bật (Gửi thật)"
                      falseLabel="Đang khóa an toàn"
                      dangerOnTrue
                    />
                  ) : (
                    <StatusBadge value={null} />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  Không liên quan tới Send Test hoặc Webhook Processing.
                </p>
              </div>

              {/* Resend Worker */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                    Resend Webhook Worker
                  </div>
                  {opsLoading ? (
                    <div className="h-6 bg-slate-200 rounded animate-pulse w-24" />
                  ) : s ? (
                    <StatusBadge
                      value={s.resend_worker_enabled}
                      trueLabel="Đang bật"
                      falseLabel="Đang tắt (Kill Switch)"
                      neutralOnFalse
                    />
                  ) : (
                    <StatusBadge value={null} />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  Chỉ xử lý webhook đã nhận, không gửi email.
                </p>
              </div>

              {/* Provider Mode */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                    Marketing Provider Mode
                  </div>
                  {opsLoading ? (
                    <div className="h-6 bg-slate-200 rounded animate-pulse w-24" />
                  ) : s ? (
                    <StatusBadge value={s.marketing_provider_mode} />
                  ) : (
                    <StatusBadge value={null} />
                  )}
                </div>
              </div>

              {/* Zalo Webhook Worker */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                    Zalo Webhook Worker
                  </div>
                  {opsLoading ? (
                    <div className="h-6 bg-slate-200 rounded animate-pulse w-24" />
                  ) : s ? (
                    <StatusBadge
                      value={s.zalo_worker_enabled}
                      trueLabel="Đang bật"
                      falseLabel="Đang tắt (Kill Switch)"
                      neutralOnFalse
                    />
                  ) : (
                    <StatusBadge value={null} />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  Chỉ xử lý webhook đã nhận, không gửi tin nhắn.
                </p>
              </div>

              {/* Cron Scheduler */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                    Cron Scheduler
                  </div>
                  {opsLoading ? (
                    <div className="h-6 bg-slate-200 rounded animate-pulse w-24" />
                  ) : s ? (
                    <Badge
                      variant="outline"
                      className="bg-slate-50 border-slate-300 text-slate-600 font-semibold gap-1 text-xs"
                    >
                      <CheckCircle2 className="w-3 h-3 text-slate-400" /> Đã kiểm chứng thủ công
                    </Badge>
                  ) : (
                    <StatusBadge value={null} />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  GitHub Actions có thể gọi định kỳ; Supabase kill switch quyết định có xử lý hay
                  không.
                </p>
              </div>

              {/* Automation/AI */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                    Automation / AI
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-slate-50 border-slate-300 text-slate-500 font-semibold gap-1 text-xs"
                  >
                    <HelpCircle className="w-3 h-3" /> Chưa xác minh
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  Xem Automation Governance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 2. Resend Worker Control (reuse shared component) ── */}
        <div>
          <SectionHeader
            icon={<Zap className="w-5 h-5 text-indigo-500" />}
            title="Resend Worker Control"
            description="Chạy thủ công Dry-run hoặc Confirm Process với phrase bảo vệ"
          />
          <ResendProcessorPanel onProcessed={fetchOpsStatus} />
        </div>

        {/* ── Zalo Webhook Processor ── */}
        <div>
          <SectionHeader
            icon={<Zap className="w-5 h-5 text-blue-500" />}
            title="Zalo Webhook Processor"
            description="Chỉ xử lý trạng thái giao nhận ZNS/Zalo. Không gửi tin, không xử lý inbox, không update suppression."
          />
          <ZaloProcessorPanel onProcessed={fetchOpsStatus} />
        </div>

        {/* ── 3. Webhook Monitoring ── */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardHeader className="pb-3 border-b border-slate-100">
            <SectionHeader
              icon={<Inbox className="w-5 h-5 text-slate-500" />}
              title="Webhook Monitoring"
              description="Thống kê read-only từ bảng webhook_events"
            />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard
                label="Pending Resend Events"
                value={c?.pending_resend_events}
                loading={opsLoading}
                color="amber"
              />
              <StatCard
                label="Pending Zalo Delivery"
                value={c?.pending_zalo_delivery_events}
                loading={opsLoading}
                color="amber"
              />
              <StatCard
                label="Inbound Zalo (Preserved)"
                value={c?.inbound_zalo_events}
                loading={opsLoading}
                color="slate"
              />
              <StatCard
                label="Failed Webhook Events"
                value={c?.failed_webhook_events}
                loading={opsLoading}
                color={c?.failed_webhook_events ? "rose" : "slate"}
              />
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4">
              <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1">
                Latest Webhook Received
              </div>
              {opsLoading ? (
                <div className="h-5 bg-slate-200 rounded animate-pulse w-40 mt-1" />
              ) : (
                <div className="text-sm font-semibold text-slate-800">
                  {t?.latest_webhook_received_at
                    ? format(new Date(t.latest_webhook_received_at), "dd/MM/yyyy HH:mm:ss")
                    : "—"}
                </div>
              )}
            </div>
            <Link
              to="/admin/webhooks"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Inbox className="w-3.5 h-3.5" />
              Mở Webhook Inbox
              <ExternalLink className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* ── 4. Marketing Safety ── */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardHeader className="pb-3 border-b border-slate-100">
            <SectionHeader
              icon={<Radio className="w-5 h-5 text-violet-500" />}
              title="Marketing Safety"
              description="Sender accounts, suppression list và delivery logs — read-only"
            />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <StatCard
                label="Active Email Suppressions"
                value={c?.active_email_suppressions}
                loading={opsLoading}
                color="amber"
              />
              <StatCard
                label="Healthy Senders"
                value={c?.healthy_sender_count}
                loading={opsLoading}
                color="emerald"
              />
              <StatCard
                label="Error Senders"
                value={c?.error_sender_count}
                loading={opsLoading}
                color={c?.error_sender_count ? "rose" : "slate"}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin/sender-accounts"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
              >
                <Radio className="w-3.5 h-3.5" /> Sender Accounts{" "}
                <ExternalLink className="w-3 h-3" />
              </Link>
              <Link
                to="/admin/webhooks"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                <DatabaseZap className="w-3.5 h-3.5" /> Delivery Logs{" "}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ── 5. Automation & AI Safety ── */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardHeader className="pb-3 border-b border-slate-100">
            <SectionHeader
              icon={<Bot className="w-5 h-5 text-amber-500" />}
              title="Automation & AI Safety"
              description="Trạng thái read-only — không có toggle trong phase này"
            />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 items-start text-xs mb-4">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-700 leading-relaxed">
                Trạng thái Automation và AI chưa có nguồn dữ liệu trực tiếp từ trang này. Vui lòng
                dùng trang <strong>Automation Governance</strong> để kiểm tra chính xác.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin/automation-governance"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" /> Automation Governance{" "}
                <ExternalLink className="w-3 h-3" />
              </Link>
              <Link
                to="/admin/ai-settings"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <Bot className="w-3.5 h-3.5" /> AI Settings <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── StatCard helper ─────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  loading,
  color = "slate",
}: {
  label: string;
  value?: number | null;
  loading?: boolean;
  color?: "slate" | "emerald" | "amber" | "rose";
}) {
  const textColors: Record<string, string> = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  };
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-center">
      <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1">{label}</div>
      {loading ? (
        <div className="h-7 bg-slate-200 rounded animate-pulse w-12 mt-1" />
      ) : value === 0 ? (
        <div className="text-sm font-semibold text-slate-400 mt-1">Chưa có dữ liệu</div>
      ) : (
        <div className={`text-2xl font-black ${textColors[color]}`}>{value ?? "—"}</div>
      )}
    </div>
  );
}
