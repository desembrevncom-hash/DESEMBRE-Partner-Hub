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
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, X, CheckCircle2, AlertTriangle, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeZnsParams, validateZnsTemplatePayload } from "@/lib/znsTemplateValidation";
import type { ZnsTemplate } from "@/lib/znsTemplateValidation";

interface BusinessSender {
  id: string;
  name: string;
  provider: string;
  channel: string;
  health_status: string;
}

interface ZnsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateToEdit?: ZnsTemplate | null;
  businessSenders: BusinessSender[];
  onSuccess: () => void;
}

export function ZnsTemplateDialog({
  open,
  onOpenChange,
  templateToEdit,
  businessSenders,
  onSuccess,
}: ZnsTemplateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sender_account_id: "",
    zalo_template_id: "",
    template_name: "",
    purpose: "",
    category: "",
    required_params: "", // comma separated list
    sample_payload: "{\n  \n}",
    is_active: true,
  });

  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    missingParams: string[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      if (templateToEdit) {
        setFormData({
          sender_account_id: templateToEdit.sender_account_id,
          zalo_template_id: templateToEdit.zalo_template_id,
          template_name: templateToEdit.template_name,
          purpose: templateToEdit.purpose || "",
          category: templateToEdit.category || "",
          required_params: templateToEdit.required_params
            ? templateToEdit.required_params.join(", ")
            : "",
          sample_payload: JSON.stringify(templateToEdit.sample_payload, null, 2),
          is_active: templateToEdit.is_active,
        });
      } else {
        // Find default Zalo OA sender
        const defaultZaloSender = businessSenders.find(
          (s) => s.channel === "zalo_oa" && s.health_status === "healthy",
        );
        setFormData({
          sender_account_id: defaultZaloSender ? defaultZaloSender.id : "",
          zalo_template_id: "",
          template_name: "",
          purpose: "transaction",
          category: "",
          required_params: "customer_name, order_code",
          sample_payload: '{\n  "customer_name": "Nguyen Van A",\n  "order_code": "DH12345"\n}',
          is_active: true,
        });
      }
      setValidationResult(null);
    }
  }, [open, templateToEdit, businessSenders]);

  const validateSamplePayload = () => {
    try {
      const payloadObj = JSON.parse(formData.sample_payload);
      const paramsArray = normalizeZnsParams(formData.required_params);

      const mockTemplate: ZnsTemplate = {
        id: "mock",
        sender_account_id: formData.sender_account_id,
        zalo_template_id: formData.zalo_template_id,
        template_name: formData.template_name,
        status: "approved",
        required_params: paramsArray,
        sample_payload: payloadObj,
        is_active: true,
      };

      const result = validateZnsTemplatePayload(mockTemplate, payloadObj);
      setValidationResult(result);

      if (result.isValid) {
        toast.success("Validation thành công: Sample payload hợp lệ.");
      } else {
        toast.error(`Validation lỗi: ${result.error}`);
      }
    } catch (e) {
      setValidationResult({
        isValid: false,
        missingParams: [],
        error: "JSON Sample Payload không hợp lệ",
      });
      toast.error("JSON không hợp lệ. Vui lòng kiểm tra lại cấu trúc.");
    }
  };

  const handleSubmit = async () => {
    if (!formData.sender_account_id) return toast.error("Vui lòng chọn Zalo OA Sender");
    if (!formData.zalo_template_id.trim()) return toast.error("Vui lòng nhập Zalo Template ID");
    if (!formData.template_name.trim()) return toast.error("Vui lòng nhập Tên Template");

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(formData.sample_payload);
    } catch (e) {
      return toast.error("JSON Sample Payload không hợp lệ");
    }

    const paramsArray = normalizeZnsParams(formData.required_params);

    setLoading(true);
    try {
      const payloadToSave = {
        sender_account_id: formData.sender_account_id,
        zalo_template_id: formData.zalo_template_id.trim(),
        template_name: formData.template_name.trim(),
        purpose: formData.purpose,
        category: formData.category,
        required_params: paramsArray,
        sample_payload: parsedPayload,
        is_active: formData.is_active,
        status: "approved", // Default for manual registry
      };

      if (templateToEdit) {
        const { error } = await supabase
          .from("zns_templates")
          .update(payloadToSave)
          .eq("id", templateToEdit.id);

        if (error) throw error;
        toast.success("Đã cập nhật template thành công");
      } else {
        const { error } = await supabase.from("zns_templates").insert(payloadToSave);

        if (error) {
          if (error.code === "23505") {
            throw new Error("Template ID này đã tồn tại cho Zalo OA Sender đã chọn");
          }
          throw error;
        }
        toast.success("Đã thêm template mới thành công");
      }

      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Lỗi lưu template: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const zaloSenders = businessSenders.filter(
    (s) => s.channel === "zalo_oa" || s.channel === "zalo",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-800">
                {templateToEdit ? "Sửa ZNS Template" : "Thêm ZNS Template (Manual)"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Khai báo metadata và required params để chuẩn bị gửi tin ZNS.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Liên kết Zalo OA Sender <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={formData.sender_account_id}
              onValueChange={(val) => setFormData({ ...formData, sender_account_id: val })}
              disabled={!!templateToEdit} // Do not allow changing sender after creation
            >
              <SelectTrigger className="h-10 rounded-xl border-slate-200">
                <SelectValue placeholder="Chọn Zalo OA Sender..." />
              </SelectTrigger>
              <SelectContent>
                {zaloSenders.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.health_status === "healthy" ? "(Healthy)" : "(Lỗi)"}
                  </SelectItem>
                ))}
                {zaloSenders.length === 0 && (
                  <SelectItem value="none" disabled>
                    Không có Zalo OA Sender nào
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Zalo Template ID <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={formData.zalo_template_id}
                onChange={(e) => setFormData({ ...formData, zalo_template_id: e.target.value })}
                placeholder="vd: 123456"
                className="h-10 rounded-xl border-slate-200 font-mono text-sm"
                disabled={!!templateToEdit}
              />
              <p className="text-[10px] text-slate-400">ID được Zalo phê duyệt</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Tên Template hiển thị <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="vd: Cảm ơn mua hàng"
                className="h-10 rounded-xl border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Purpose</Label>
              <Select
                value={formData.purpose}
                onValueChange={(val) => setFormData({ ...formData, purpose: val })}
              >
                <SelectTrigger className="h-10 rounded-xl border-slate-200">
                  <SelectValue placeholder="Mục đích..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transaction">Giao dịch (Transaction)</SelectItem>
                  <SelectItem value="otp">OTP</SelectItem>
                  <SelectItem value="marketing">Quảng cáo (Marketing)</SelectItem>
                  <SelectItem value="customer_care">CSKH (Customer Care)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Category</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="vd: order_success"
                className="h-10 rounded-xl border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Required Parameters <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={formData.required_params}
              onChange={(e) => setFormData({ ...formData, required_params: e.target.value })}
              placeholder="customer_name, order_code, amount, phone"
              className="h-10 rounded-xl border-slate-200 font-mono text-xs"
            />
            <div className="flex gap-1 flex-wrap mt-1">
              {normalizeZnsParams(formData.required_params).map((p) => (
                <Badge
                  key={p}
                  variant="secondary"
                  className="text-[10px] bg-slate-100 text-slate-600 font-mono"
                >
                  {p}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700">
                Sample Payload (JSON format)
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={validateSamplePayload}
                className="h-6 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 rounded-lg"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> Validate
              </Button>
            </div>
            <Textarea
              value={formData.sample_payload}
              onChange={(e) => {
                setFormData({ ...formData, sample_payload: e.target.value });
                setValidationResult(null);
              }}
              placeholder='{\n  "customer_name": "A",\n  "order_code": "123"\n}'
              className={`font-mono text-xs h-32 rounded-xl resize-none ${validationResult?.isValid === false ? "border-rose-300 focus-visible:ring-rose-200" : "border-slate-200"}`}
            />
            {validationResult && (
              <div
                className={`mt-2 text-[11px] p-2 rounded-lg flex items-start gap-1.5 ${validationResult.isValid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
              >
                {validationResult.isValid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="font-medium">
                      Payload hợp lệ. Tất cả các tham số bắt buộc đã được cung cấp.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="font-medium">{validationResult.error}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-800">Kích hoạt Template</p>
              <p className="text-[11px] text-slate-500">
                Chỉ template Active mới có thể gửi tin nhắn.
              </p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(c) => setFormData({ ...formData, is_active: c })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-10 font-bold"
            disabled={loading}
          >
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            className="rounded-xl h-10 font-bold bg-slate-900 text-white"
            disabled={loading}
          >
            {loading ? "Đang lưu..." : "Lưu Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
