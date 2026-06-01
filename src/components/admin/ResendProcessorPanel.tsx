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
  Zap 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

export interface ProcessorResult {
  success?: boolean;
  dry_run?: boolean;
  lock_acquired?: boolean;
  scanned?: number;
  would_update_delivery_logs?: number;
  updated_delivery_logs?: number;
  delivery_log_not_found?: number;
  would_suppress?: number;
  suppressed?: number;
  already_suppressed?: number;
  would_ignore?: number;
  ignored?: number;
  would_fail?: number;
  failed?: number;
  processed_event_ids?: string[];
  ignored_event_ids?: string[];
  failed_event_ids?: string[];
  error?: string;
  step?: string;
  message?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ResultStat
 * ────────────────────────────────────────────────────────────────────────── */

export function ResultStat({
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
 * ResendProcessorPanel
 * ────────────────────────────────────────────────────────────────────────── */

export function ResendProcessorPanel({ onProcessed }: { onProcessed?: () => void }) {
  const [runLoading, setRunLoading] = useState(false);
  const [result, setResult] = useState<ProcessorResult | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [showConfirmInput, setShowConfirmInput] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const CONFIRM_STRING = "PROCESS_RESEND_WEBHOOKS";

  const fetchPendingCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true })
        .eq("provider", "resend")
        .eq("signature_valid", true)
        .eq("status", "received")
        .in("event_type", [
          "email.delivered",
          "email.opened",
          "email.clicked",
          "email.bounced",
          "email.complained",
          "email.failed",
        ]);
      if (!error) setPendingCount(count ?? 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

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

      const url = `${(supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-resend-webhook-events`;
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
        setResult({ error: "already_running", message: data.message || "Worker đang chạy bởi một request khác." });
        toast.warning("Worker đang chạy", { description: "Một phiên xử lý khác đang hoạt động. Vui lòng thử lại sau." });
        return;
      }

      if (!res.ok) {
        setResult({ error: data.error || "unknown_error", message: data.details || data.message || res.statusText });
        toast.error("Lỗi Worker", { description: data.error || res.statusText });
        return;
      }

      setResult(data);
      if (confirm && data.success) {
        toast.success("Xử lý thành công!", {
          description: `Đã xử lý ${data.scanned} events. Updated: ${data.updated_delivery_logs || 0} logs, ${data.suppressed || 0} suppressed.`,
        });
        onProcessed?.();
        fetchPendingCount();
      } else if (!confirm && data.success) {
        toast.info("Dry-run hoàn tất", { description: `Quét ${data.scanned} events. Không ghi DB.` });
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
    <Card
      id="resend-processor-panel"
      className="shadow-sm border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/40 overflow-hidden"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Resend Webhook Processor</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Xử lý thủ công Resend events → Delivery Logs + Suppression List
              </CardDescription>
            </div>
          </div>
          {pendingCount !== null && (
            <Badge
              variant="outline"
              className={`font-bold text-xs px-3 py-1 ${
                pendingCount > 0
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : "bg-emerald-50 border-emerald-300 text-emerald-700"
              }`}
            >
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 flex gap-2 items-start text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-amber-700 leading-relaxed">
            <strong>Confirm Process</strong> sẽ cập nhật <strong>Delivery Logs</strong> và{" "}
            <strong>Suppression List</strong>. Không gửi email. Không gọi provider API. Không trigger automation.
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3 items-center">
          <Button
            id="btn-dry-run"
            variant="outline"
            size="sm"
            disabled={runLoading}
            onClick={() => callWorker(false)}
            className="h-9 rounded-lg border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 gap-1.5"
          >
            {runLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Dry-run
          </Button>

          {!showConfirmInput ? (
            <Button
              id="btn-show-confirm"
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
                id="input-confirm-phrase"
                placeholder={`Gõ "${CONFIRM_STRING}" để xác nhận`}
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                className="h-9 w-72 text-sm font-mono rounded-lg border-rose-200 focus:ring-rose-300"
                disabled={runLoading}
                autoFocus
              />
              <Button
                id="btn-confirm-process"
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
                {runLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
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

        {/* Result */}
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
                    {result.error === "already_running" ? "Worker đang chạy" : `Lỗi: ${result.error}`}
                  </span>
                </>
              ) : result.dry_run ? (
                <>
                  <Eye className="w-4 h-4 text-sky-600" />
                  <span className="text-sky-700">Dry-run Result</span>
                  <Badge className="bg-sky-100 text-sky-700 border-sky-300 text-[10px]">PREVIEW</Badge>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Confirm Run Result</span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">EXECUTED</Badge>
                </>
              )}
            </div>

            {result.message && <p className="text-xs text-rose-600">{result.message}</p>}

            {result.success && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <ResultStat label="Scanned" value={result.scanned} />
                {result.dry_run ? (
                  <>
                    <ResultStat label="Would Update Logs" value={result.would_update_delivery_logs} highlight="sky" />
                    <ResultStat label="Would Suppress" value={result.would_suppress} highlight="amber" />
                    <ResultStat label="Would Ignore" value={result.would_ignore} />
                  </>
                ) : (
                  <>
                    <ResultStat label="Updated Logs" value={result.updated_delivery_logs} highlight="emerald" />
                    <ResultStat label="Suppressed" value={result.suppressed} highlight="amber" />
                    <ResultStat label="Already Suppressed" value={result.already_suppressed} />
                    <ResultStat label="Log Not Found" value={result.delivery_log_not_found} />
                    <ResultStat label="Ignored" value={result.ignored} />
                    <ResultStat label="Failed" value={result.failed} highlight={result.failed ? "rose" : undefined} />
                    <ResultStat label="Processed IDs" value={result.processed_event_ids?.length} highlight="emerald" />
                  </>
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
      </CardContent>
    </Card>
  );
}
