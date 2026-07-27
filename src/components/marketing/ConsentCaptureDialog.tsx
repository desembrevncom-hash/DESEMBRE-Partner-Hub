import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Mail, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ConsentCaptureDialog({ customerId, customerEmail, currentStatus, onSuccess }: { 
    customerId: string;
    customerEmail: string;
    currentStatus?: boolean;
    onSuccess?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("internal_test_account");
  const [note, setNote] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maskedEmail = customerEmail 
    ? `${customerEmail.substring(0, 4)}***${customerEmail.substring(customerEmail.indexOf("@"))}` 
    : "No email";

  const handleRecordConsent = async () => {
    if (confirmText !== "RECORD_EMAIL_MARKETING_CONSENT") {
      toast.error("Vui lòng nhập chính xác mã xác nhận.");
      return;
    }

    if (!source || !note) {
      toast.error("Vui lòng cung cấp đủ Source và Note.");
      return;
    }

    if (note.trim().length < 10) {
      toast.error("Note (Bằng chứng) quá ngắn. Vui lòng nhập tối thiểu 10 ký tự.");
      return;
    }

    try {
      setIsSubmitting(true);
      const { data, error } = await supabase.rpc("admin_record_email_marketing_consent", {
        p_customer_id: customerId,
        p_source: source,
        p_note: note
      });

      if (error) {
        throw error;
      }

      toast.success("Đã ghi nhận Consent (Opt-in) thành công.");
      setOpen(false);
      setConfirmText("");
      setNote("");
      if (onSuccess) await onSuccess();
    } catch (e: any) {
      toast.error("Lỗi khi ghi nhận: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 h-8 text-xs font-bold">
          <ShieldCheck className="w-3 h-3 mr-2" />
          Record Marketing Consent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-indigo-800">
            <Mail className="w-5 h-5 mr-2" />
            Capture Marketing Consent
          </DialogTitle>
          <DialogDescription>
            Tạo bằng chứng (proof) ghi nhận khách hàng đã đồng ý nhận Marketing Email.
            Hành động này không gửi email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="font-medium">{maskedEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Legacy Opt-in Status:</span>
              <span className="font-medium">
                {currentStatus ? <span className="text-green-600">Đã tick</span> : <span className="text-red-500">Chưa tick / Hủy</span>}
              </span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 flex gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <p>CHỈ thực hiện thao tác này nếu bạn chắc chắn khách hàng là tester nội bộ hoặc đã có bằng chứng đồng ý (written permission).</p>
          </div>

          <div className="space-y-2">
            <Label>Consent Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Select a source..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal_test_account">Tài khoản Test nội bộ</SelectItem>
                <SelectItem value="written_permission">Có sự đồng ý bằng văn bản/tin nhắn</SelectItem>
                <SelectItem value="customer_form">Biểu mẫu khách hàng (Customer Form)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Note / Proof Reference</Label>
            <Input 
              placeholder="VD: KH đồng ý qua tin nhắn Zalo ngày..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-red-600 font-bold">Confirmation</Label>
            <p className="text-xs text-slate-500 mb-1">Gõ chính xác <code>RECORD_EMAIL_MARKETING_CONSENT</code> để xác nhận.</p>
            <Input 
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="font-mono text-xs"
              placeholder="RECORD_EMAIL_MARKETING_CONSENT"
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            onClick={handleRecordConsent}
            disabled={isSubmitting || confirmText !== "RECORD_EMAIL_MARKETING_CONSENT" || note.trim().length < 10}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Xác nhận Ghi nhận Consent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
