/* eslint-disable */
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Eye,
  Loader2,
  Lock,
  Play,
  Zap,
  MessageSquare,
  ArrowRightLeft,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CRMCard } from "@/components/crm/CRMCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

export interface ZaloProcessorResult {
  success?: boolean;
  dry_run?: boolean;
  lock_acquired?: boolean;
  scanned?: number;
  would_update_delivery_logs?: number;
  updated_delivery_logs?: number;
  processed?: number;
  skipped_non_delivery?: number;
  failed?: number;
  delivery_log_found?: number;
  delivery_log_not_found?: number;
  missing_related_message_id?: number;
  processed_event_ids?: string[];
  skipped_event_ids?: string[];
  failed_event_ids?: string[];
  error?: string;
  step?: string;
  message?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ZaloResultStat
 * ────────────────────────────────────────────────────────────────────────── */

export function ZaloResultStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: number;
  highlight?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-700 bg-emerald-100/80",
    amber: "text-amber-700 bg-amber-100/80",
    rose: "text-rose-700 bg-rose-100/80",
    sky: "text-sky-700 bg-sky-100/80",
  };
  const cls = highlight ? colorMap[highlight] || "" : "text-slate-700 bg-slate-100/80";
  return (
    <div className={`rounded-md px-2.5 py-1.5 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase opacity-70">{label}</div>
      <div className="text-lg font-black">{value ?? 0}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ZaloProcessorPanel
 * ────────────────────────────────────────────────────────────────────────── */

export function ZaloProcessorPanel({ onProcessed }: { onProcessed?: () => void }) {
  const [runLoading, setRunLoading] = useState(false);
  const [result, setResult] = useState<ZaloProcessorResult | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [showConfirmInput, setShowConfirmInput] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [inboundCount, setInboundCount] = useState<number | null>(null);

  const CONFIRM_STRING = "PROCESS_ZALO_WEBHOOKS";

  const fetchPendingCounts = useCallback(async () => {
    try {
      // 1. Zalo Pending Delivery Events
      const { count: dCount, error: dError } = await supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true })
        .in("provider", ["zalo", "zalo_zbs"])
        .eq("signature_valid", true)
        .eq("status", "received")
        .in("event_type", [
          "user_received_message",
          "zns_delivered",
          "zns_failed",
          "user_seen_message",
        ]);

      if (!dError) setPendingCount(dCount ?? 0);

      // 2. Zalo Inbound Events (non-delivery)
      const { count: iCount, error: iError } = await supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true })
        .in("provider", ["zalo", "zalo_zbs"])
        .eq("signature_valid", true)
        .eq("status", "received")
        .not(
          "event_type",
          "in",
          '("user_received_message","zns_delivered","zns_failed","user_seen_message")',
        );

      if (!iError) setInboundCount(iCount ?? 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPendingCounts();
  }, [fetchPendingCounts]);

  const callWorker = async (confirm: boolean) => {
    setRunLoading(true);
    setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error("Không có phiên đăng nhập. Vui lòng đăng nhập lại.");
        return;
      }

      const body: any = {};
      if (confirm) body.confirm = CONFIRM_STRING;

      const url = `${(supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-zalo-webhook-events`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 409) {
        setResult({
          error: "already_running",
          message: data.message || "Worker đang chạy bởi một request khác.",
        });
        toast.warning("Worker đang chạy", {
          description: "Một phiên xử lý khác đang hoạt động. Vui lòng thử lại sau.",
        });
        return;
      }

      if (!res.ok) {
        setResult({
          error: data.error || "unknown_error",
          message: data.details || data.message || res.statusText,
        });
        toast.error("Lỗi Worker", { description: data.error || res.statusText });
        return;
      }

      setResult(data);
      if (confirm && data.success) {
        toast.success("Xử lý thành công!", {
          description: `Đã quét ${data.scanned} events. Cập nhật ${data.updated_delivery_logs || 0} logs.`,
        });
        onProcessed?.();
        fetchPendingCounts();
      } else if (!confirm && data.success) {
        toast.info("Dry-run hoàn tất", {
          description: `Quét ${data.scanned} events. Không ghi DB.`,
        });
      }
    } catch (err: any) {
      setResult({ error: err.message });
      toast.error("Lỗi kết nối", { description: err.message });
    } finally {
      setRunLoading(false);
      setConfirmPhrase("");
      setShowConfirmInput(false);
    }
  };

  const canConfirm = confirmPhrase === CONFIRM_STRING;

  return (
    <CRMCard
      id="zalo-processor-panel"
      className="shadow-sm border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-sky-50/40 p-0 overflow-hidden"
    >
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Zalo Webhook Processor
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Xử lý thủ công Zalo webhook events → Delivery Logs. Chỉ xử lý trạng thái giao nhận
                ZNS/Zalo.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount !== null && (
              <Badge
                variant="outline"
                className={`font-bold text-xs px-3 py-1 ${
                  pendingCount > 0
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "bg-emerald-50 border-emerald-300 text-emerald-700"
                }`}
              >
                {pendingCount} pending delivery
              </Badge>
            )}
            {inboundCount !== null && (
              <Badge
                variant="outline"
                className="bg-slate-50 border-slate-300 text-slate-600 font-semibold text-xs px-3 py-1"
              >
                {inboundCount} inbound (quan sát)
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="p-5 pt-0 space-y-4">
        {/* Wording and Warnings */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 flex gap-2 items-start text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-amber-700 space-y-1.5 leading-relaxed">
            <div>
              <strong>Chỉ xử lý trạng thái giao nhận ZNS/Zalo.</strong> Không gửi tin nhắn. Không xử
              lý inbox/hội thoại. Không update suppression.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-amber-200/50">
              <div>
                <span className="font-bold">Dry-run:</span> “Chạy thử, không ghi DB.”
              </div>
              <div>
                <span className="font-bold">Confirm:</span> “Có thể cập nhật Delivery Logs và trạng
                thái webhook delivery events. Không gửi tin nhắn.”
              </div>
              <div>
                <span className="font-bold">Non-delivery:</span> “Tin nhắn khách gửi vào OA sẽ không
                bị xử lý bởi worker này.”
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3 items-center">
          <Button
            id="zalo-btn-dry-run"
            variant="outline"
            size="sm"
            disabled={runLoading}
            onClick={() => callWorker(false)}
            className="h-9 rounded-lg border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 gap-1.5"
          >
            {runLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run Dry-run
          </Button>

          {!showConfirmInput ? (
            <Button
              id="zalo-btn-show-confirm"
              variant="outline"
              size="sm"
              disabled={runLoading}
              onClick={() => setShowConfirmInput(true)}
              className="h-9 rounded-lg border-rose-200 bg-white hover:bg-rose-50 font-semibold text-rose-700 gap-1.5"
            >
              <Zap className="w-4 h-4" />
              Confirm Process...
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                id="zalo-input-confirm-phrase"
                placeholder={`Gõ "${CONFIRM_STRING}" để xác nhận`}
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                className="h-9 w-full sm:w-72 text-sm font-mono rounded-lg border-rose-200 focus:ring-rose-300"
                disabled={runLoading}
                autoFocus
              />
              <Button
                id="zalo-btn-confirm-process"
                variant="default"
                size="sm"
                disabled={!canConfirm || runLoading}
                onClick={() => callWorker(true)}
                className={`h-9 rounded-lg font-bold gap-1.5 transition-all ${
                  canConfirm
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {runLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Xác nhận xử lý
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowConfirmInput(false);
                  setConfirmPhrase("");
                }}
                disabled={runLoading}
                className="h-9 text-slate-500"
              >
                Huỷ
              </Button>
            </div>
          )}
        </div>

        {/* Result Summary */}
        {result && (
          <div
            className={`rounded-lg border p-4 text-sm space-y-3 ${
              result.error
                ? "bg-rose-50 border-rose-200"
                : result.dry_run
                  ? "bg-sky-50 border-sky-200"
                  : "bg-emerald-50 border-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {result.error ? (
                <>
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span className="text-rose-700">
                    {result.error === "already_running"
                      ? "Worker đang chạy"
                      : `Lỗi: ${result.error}`}
                  </span>
                </>
              ) : result.dry_run ? (
                <>
                  <Eye className="w-4 h-4 text-sky-600" />
                  <span className="text-sky-700">Zalo Dry-run Result</span>
                  <Badge className="bg-sky-100 text-sky-700 border-sky-300 text-[10px]">
                    PREVIEW
                  </Badge>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Zalo Confirm Run Result</span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">
                    EXECUTED
                  </Badge>
                </>
              )}
            </div>

            {result.message && <p className="text-xs text-rose-600">{result.message}</p>}

            {result.success && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <ZaloResultStat label="Scanned" value={result.scanned} />
                  {result.dry_run ? (
                    <ZaloResultStat
                      label="Would Update Logs"
                      value={result.would_update_delivery_logs}
                      highlight="sky"
                    />
                  ) : (
                    <ZaloResultStat
                      label="Updated Logs"
                      value={result.updated_delivery_logs}
                      highlight="emerald"
                    />
                  )}
                  <ZaloResultStat label="Processed" value={result.processed} highlight="emerald" />
                  <ZaloResultStat
                    label="Skipped Non-Delivery"
                    value={result.skipped_non_delivery}
                    highlight="amber"
                  />
                  <ZaloResultStat
                    label="Failed"
                    value={result.failed}
                    highlight={result.failed ? "rose" : undefined}
                  />
                  <ZaloResultStat label="Log Found" value={result.delivery_log_found} />
                  <ZaloResultStat label="Log Not Found" value={result.delivery_log_not_found} />
                  <ZaloResultStat
                    label="Missing ID"
                    value={result.missing_related_message_id}
                    highlight={result.missing_related_message_id ? "rose" : undefined}
                  />
                </div>

                {/* Preservation note for inbound events */}
                {result.skipped_non_delivery !== undefined && result.skipped_non_delivery > 0 && (
                  <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-2.5 text-xs text-blue-700 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>
                      Các event inbound được giữ nguyên để phục vụ Inbox/Automation sau này.
                    </span>
                  </div>
                )}
              </div>
            )}

            {result.lock_acquired !== undefined && (
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Lock acquired: {result.lock_acquired ? "✅" : "❌"}
              </div>
            )}
          </div>
        )}
      </div>
    </CRMCard>
  );
}
