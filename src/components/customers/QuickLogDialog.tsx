import { useState } from "react";
import { 
  Phone, 
  MessageCircle, 
  User, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Send,
  Zap
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface QuickLogDialogProps {
  customer: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QuickLogDialog({ customer, isOpen, onClose, onSuccess }: QuickLogDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"call" | "zalo_message" | "online_consultation" | "note">("call");
  const [content, setContent] = useState("");

  const handleSubmit = async () => {
    if (!content.trim()) return toast.error("Vui lòng nhập nội dung ghi chú");
    setLoading(true);
    try {
      const typeLabels = {
        "call": "Gọi điện",
        "zalo_message": "Chat Zalo",
        "online_consultation": "Tư vấn",
        "note": "Ghi chú nhanh"
      };

      const { error } = await supabase.from("customer_activities").insert({
        customer_id: customer.id,
        activity_type: type,
        title: typeLabels[type] || "Ghi chú mới",
        content: content.trim(),
        created_by: user?.id
      });

      if (error) throw error;

      toast.success("Đã lưu nhật ký tương tác");
      setContent("");
      onSuccess?.();
      onClose();
    } catch (e: any) {
      console.error("Lỗi khi lưu ghi chú:", e);
      toast.error(`Lỗi khi lưu ghi chú: ${e.message || "Lỗi không xác định"}`);
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: "call", label: "Gọi điện", icon: Phone, color: "text-amber-500 bg-amber-50" },
    { id: "zalo_message", label: "Chat Zalo", icon: MessageCircle, color: "text-indigo-500 bg-indigo-50" },
    { id: "online_consultation", label: "Tư vấn", icon: User, color: "text-emerald-500 bg-emerald-50" },
    { id: "note", label: "Ghi chú", icon: FileText, color: "text-slate-500 bg-slate-50" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] rounded-[32px] border-none shadow-2xl p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg font-black text-slate-900 uppercase tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
               <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            Ghi chú nhanh
          </DialogTitle>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] pt-2">
            Khách hàng: <span className="text-slate-900">{customer?.facility_name || customer?.name}</span>
          </p>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="grid grid-cols-4 gap-3">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id as any)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-2 ${
                  type === t.id 
                    ? "border-slate-900 bg-slate-50 shadow-sm" 
                    : "border-transparent hover:border-slate-100"
                }`}
              >
                <div className={`p-2 rounded-lg ${t.color}`}>
                   <t.icon className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung tương tác</Label>
            <Textarea 
              placeholder="Vd: Khách đang cân nhắc bộ Nám, hẹn gọi lại sau 2 ngày..." 
              className="min-h-[120px] rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all text-sm font-medium resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold text-slate-400">Hủy</Button>
          <Button 
            disabled={loading}
            onClick={handleSubmit}
            className="rounded-xl bg-slate-900 hover:bg-black font-black px-8 h-12 shadow-lg shadow-slate-200"
          >
            {loading ? "Đang lưu..." : (
              <>Lưu Nhật ký <Send className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
