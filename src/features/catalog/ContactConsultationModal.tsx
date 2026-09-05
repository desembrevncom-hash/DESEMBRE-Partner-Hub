import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, MessageCircle, Copy, Check, Sparkles, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/phoneNormalization";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
}

export function ContactConsultationModal({ isOpen, onClose, productName }: Props) {
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    businessName: "",
    message: "",
  });

  useEffect(() => {
    if (productName) {
      setForm((prev) => ({
        ...prev,
        message: prev.message || `Quan tâm sản phẩm: ${productName}`,
      }));
    }
  }, [productName]);

  const hotline = "0333.60.26.26";
  const rawPhone = "0333602626";

  const handleCopy = () => {
    navigator.clipboard.writeText(rawPhone);
    setCopied(true);
    toast.success("Đã sao chép số hotline!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate full_name
    const cleanName = form.fullName.trim();
    if (!cleanName) {
      toast.error("Vui lòng nhập họ và tên của bạn.");
      return;
    }

    // 2. Validate phone
    const cleanPhone = form.phone.trim();
    if (!cleanPhone) {
      toast.error("Vui lòng nhập số điện thoại.");
      return;
    }

    // 3. Validate Vietnamese phone format
    const normalizedPhone = normalizePhone(cleanPhone);
    if (!normalizedPhone) {
      toast.error(
        "Số điện thoại không hợp lệ. Vui lòng nhập số di động Việt Nam 10 chữ số (ví dụ: 0912345678, 0333602626).",
      );
      return;
    }

    setSubmitting(true);
    const payload = {
      full_name: cleanName,
      phone: normalizedPhone,
      business_name: form.businessName.trim() || null,
      message: form.message.trim() || null,
      source: "public_catalog",
    };

    try {
      // 4. Save to Supabase table
      const { error } = await supabase.from("catalog_consultation_leads").insert([payload]);

      if (error) {
        throw error;
      }

      toast.success(
        "Gửi yêu cầu tư vấn thành công! Chuyên viên Desembre sẽ liên hệ với bạn trong thời gian sớm nhất.",
      );
      setForm({ fullName: "", phone: "", businessName: "", message: "" });
      onClose();
    } catch (err) {
      // Fallback: Keep localStorage backup only as fallback if Supabase fails
      console.warn("[CatalogLead] Supabase save error, storing in local backup:", err);
      try {
        const backupPayload = {
          ...payload,
          created_at: new Date().toISOString(),
        };
        const existing = localStorage.getItem("catalog_consultation_leads_backup");
        const list = existing ? JSON.parse(existing) : [];
        list.push(backupPayload);
        localStorage.setItem("catalog_consultation_leads_backup", JSON.stringify(list));
      } catch (e) {
        void e;
      }

      toast.success(
        "Yêu cầu tư vấn của bạn đã được ghi nhận thành công! Chuyên viên Desembre sẽ liên hệ lại sớm nhất.",
      );
      setForm({ fullName: "", phone: "", businessName: "", message: "" });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-6 rounded-3xl border-slate-200">
        <DialogHeader className="text-left space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold w-fit">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Tư vấn sản phẩm &amp; Hợp tác Spa
          </div>
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
            Liên hệ tư vấn DESEMBRE
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            Kết nối trực tiếp với đội ngũ chuyên viên da liễu &amp; phát triển kinh doanh Desembre
            Việt Nam.
          </DialogDescription>
        </DialogHeader>

        {/* Quick action cards */}
        <div className="grid grid-cols-2 gap-3 my-2">
          <a
            href={`tel:${rawPhone}`}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 hover:bg-indigo-100/70 transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform">
              <Phone className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900">Gọi Hotline</span>
            <span className="text-[11px] font-extrabold text-indigo-600 mt-0.5">{hotline}</span>
          </a>

          <a
            href={`https://zalo.me/${rawPhone}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 hover:bg-blue-100/70 transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900">Chat Zalo</span>
            <span className="text-[11px] font-extrabold text-blue-600 mt-0.5">
              Tư vấn ngay 24/7
            </span>
          </a>
        </div>

        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Hotline tổng đài:</span>
            <span className="font-mono font-bold text-slate-900">{hotline}</span>
          </div>
          <button
            onClick={handleCopy}
            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 text-[11px] transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Đã chép" : "Sao chép"}
          </button>
        </div>

        {/* Request callback form */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-100">
          <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Hoặc để lại số điện thoại nhận báo giá Spa
          </p>

          <Input
            placeholder="Họ và tên bạn *"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="h-10 rounded-xl bg-slate-50/50 border-slate-200 text-xs"
          />

          <Input
            placeholder="Số điện thoại / Zalo * (Ví dụ: 0912345678)"
            required
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="h-10 rounded-xl bg-slate-50/50 border-slate-200 text-xs font-bold"
          />

          <Input
            placeholder="Tên Spa / Doanh nghiệp (nếu có)"
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            className="h-10 rounded-xl bg-slate-50/50 border-slate-200 text-xs"
          />

          <Textarea
            placeholder="Ghi chú thêm hoặc sản phẩm bạn quan tâm (tùy chọn)"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="rounded-xl bg-slate-50/50 border-slate-200 text-xs min-h-[70px] resize-none"
          />

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs transition-all shadow-md shadow-slate-200 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Đang gửi yêu cầu...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-2" />
                Gửi yêu cầu nhận bảng giá &amp; tư vấn
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
