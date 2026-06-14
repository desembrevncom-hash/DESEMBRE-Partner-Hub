import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send, CheckCircle2, AlertTriangle, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ZnsTemplate } from "@/lib/znsTemplateValidation";
import { normalizeZnsParams } from "@/lib/znsTemplateValidation";

interface ZnsTestSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ZnsTemplate | null;
}

export function ZnsTestSendDialog({ open, onOpenChange, template }: ZnsTestSendDialogProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string | null }[]>(
    [],
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [payloadJson, setPayloadJson] = useState<string>("");

  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    preview_phone?: string;
    error?: string;
    is_provider_disabled?: boolean;
  } | null>(null);

  useEffect(() => {
    if (open && template) {
      setPayloadJson(JSON.stringify(template.sample_payload, null, 2));
      setValidationResult(null);
      fetchTestCustomers();
    }
  }, [open, template]);

  const fetchTestCustomers = async () => {
    try {
      // Lấy 10 khách hàng mới nhất có số điện thoại
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone")
        .not("phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      setCustomers(data || []);
      if (data && data.length > 0) setSelectedCustomerId(data[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunValidation = async () => {
    if (!selectedCustomerId) return toast.error("Vui lòng chọn khách hàng test");
    if (!template) return;

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(payloadJson);
    } catch (e) {
      setValidationResult({ isValid: false, error: "JSON Payload không hợp lệ" });
      return;
    }

    setLoading(true);
    try {
      toast.error("Tính năng Validation tạm thời bị khóa trong M4 (Không gọi Edge Function).");
      setValidationResult({ isValid: false, error: "Bị khóa trong M4" });
    } catch (e: any) {
      setValidationResult({ isValid: false, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedCustomerId || !template) return;

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(payloadJson);
    } catch (e) {
      return toast.error("JSON Payload không hợp lệ");
    }

    if (
      !window.confirm(
        "Bạn có chắc chắn muốn gửi tin nhắn ZNS thật qua Zalo API đến khách hàng này không? Quá trình này sẽ tốn phí ZNS.",
      )
    )
      return;

    setLoading(true);
    try {
      toast.error("Tính năng Test Send qua Zalo API tạm thời bị khóa trong M4 (Zero Sending Guarantee).");
    } catch (e: any) {
      toast.error("Lỗi gửi tin: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-800">Test Send ZNS</DialogTitle>
              <DialogDescription className="text-xs">
                Gửi test template{" "}
                <span className="font-bold text-slate-700">{template.template_name}</span> qua Zalo
                API.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Khách hàng nhận Test</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200">
                <SelectValue placeholder="Chọn khách hàng..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Yêu cầu tham số</Label>
            <div className="flex gap-1 flex-wrap">
              {template.required_params && template.required_params.length > 0 ? (
                template.required_params.map((p) => (
                  <Badge
                    key={p}
                    variant="secondary"
                    className="text-[10px] bg-slate-100 text-slate-600 font-mono"
                  >
                    {p}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-slate-400">Không có</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Template Data (JSON Payload)</Label>
            <Textarea
              value={payloadJson}
              onChange={(e) => {
                setPayloadJson(e.target.value);
                setValidationResult(null);
              }}
              className="font-mono text-xs h-32 rounded-xl border-slate-200"
            />
          </div>

          {/* Result Block */}
          {validationResult && (
            <div
              className={`mt-2 p-3 rounded-xl flex items-start gap-2 ${
                validationResult.isValid
                  ? "bg-emerald-50 border border-emerald-100"
                  : validationResult.is_provider_disabled
                    ? "bg-amber-50 border border-amber-100"
                    : "bg-rose-50 border border-rose-100"
              }`}
            >
              {validationResult.isValid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <div className="text-emerald-800">
                    <p className="font-bold text-sm">Payload Hợp Lệ</p>
                    <p className="text-xs mt-0.5">
                      SĐT gửi đi (format Zalo):{" "}
                      <span className="font-mono font-bold bg-emerald-100 px-1 rounded">
                        {validationResult.preview_phone}
                      </span>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${validationResult.is_provider_disabled ? "text-amber-600" : "text-rose-600"}`}
                  />
                  <div
                    className={
                      validationResult.is_provider_disabled ? "text-amber-800" : "text-rose-800"
                    }
                  >
                    <p className="font-bold text-sm">Bị chặn / Lỗi</p>
                    <p className="text-xs mt-0.5">{validationResult.error}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            variant="outline"
            onClick={handleRunValidation}
            className="rounded-xl h-10 font-bold"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <MessageSquare className="w-4 h-4 mr-2" />
            )}
            Validate Only
          </Button>

          <Button
            onClick={handleSendTest}
            className="rounded-xl h-10 font-bold bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loading || !validationResult?.isValid}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Gửi ZNS Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
