import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Calendar, ClipboardList, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AddTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any;
  onSuccess: () => void;
}

const TASK_TYPE_OPTIONS = [
  { value: "call", label: "📞 Gọi điện thoại" },
  { value: "reactivation", label: "✨ Chăm sóc lại" },
  { value: "event_invite", label: "🎟️ Mời sự kiện" },
  { value: "check_in", label: "👋 Thăm hỏi định kỳ" },
  { value: "lead_qualification", label: "🎯 Đánh giá tiềm năng" },
  { value: "quote_follow_up", label: "💰 Theo dõi báo giá" },
  { value: "reorder_reminder", label: "📦 Nhắc đặt hàng lại" },
];

export function AddTaskDialog({ isOpen, onClose, customer, onSuccess }: AddTaskDialogProps) {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const isManager = isAdmin || isSubAdmin;
  const [saving, setSaving] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);

  const [form, setForm] = useState({
    title: "",
    task_type: "call",
    priority: "normal",
    assigned_to: "",
    due_at: "",
    note: "",
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        title: "",
        task_type: "call",
        priority: "normal",
        assigned_to: customer?.owner_sale_id || customer?.owner_tele_id || user?.id || "",
        due_at: "",
        note: "",
      });
      fetchStaff();
    }
  }, [isOpen, customer]);

  const fetchStaff = async () => {
    if (!isManager) {
      // Nếu là Staff, họ chỉ có quyền giao việc cho chính mình. Tránh gọi API profiles gây lỗi RLS.
      setStaffList([{
        id: user?.id,
        name: user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Tôi"
      }]);
      return;
    }

    setLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email");
      
      if (error) throw error;
      if (data) {
        setStaffList(data.map((p: any) => ({
          id: p.id,
          name: p.display_name || p.email?.split("@")[0] || "Chưa đặt tên"
        })));
      }
    } catch (e: any) {
      console.error("Error fetching staff:", e);
      // Fallback cho local demo hoặc khi lỗi mạng/RLS
      setStaffList([{
        id: user?.id,
        name: user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Tôi"
      }]);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề việc cần làm");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        task_type: form.task_type,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        assigned_by: user?.id || null,
        customer_id: customer.id,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        note: form.note.trim() || null,
        status: "pending",
      };

      const { error } = await supabase.from("customer_tasks").insert([payload]);

      if (error) throw error;

      toast.success("✨ Đã thêm việc cần làm thành công!");
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error("Không thể thêm việc cần làm:", e);
      toast.error("Lỗi: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] rounded-[32px] border-none shadow-2xl p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg font-black text-slate-900 uppercase tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
               <ClipboardList className="w-5 h-5 text-indigo-400" />
            </div>
            Thêm việc cần làm
          </DialogTitle>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] pt-2">
            Khách hàng: <span className="text-slate-900">{customer?.facility_name || customer?.name}</span>
          </p>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Tiêu đề */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề công việc <span className="text-red-500">*</span></Label>
            <Input 
              placeholder="Ví dụ: Gọi điện báo giá bộ Nám, gửi thiệp mời sự kiện..."
              className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white text-sm font-medium h-11"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Loại hình */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại hình</Label>
              <Select value={form.task_type} onValueChange={val => setForm({ ...form, task_type: val })}>
                <SelectTrigger className="rounded-xl border-slate-100 bg-slate-50 h-11 text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {TASK_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-semibold">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Độ ưu tiên */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Độ ưu tiên</Label>
              <Select value={form.priority} onValueChange={val => setForm({ ...form, priority: val })}>
                <SelectTrigger className="rounded-xl border-slate-100 bg-slate-50 h-11 text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="high" className="text-xs font-bold text-red-600">🔴 Cao</SelectItem>
                  <SelectItem value="normal" className="text-xs font-semibold text-slate-700">🔵 Bình thường</SelectItem>
                  <SelectItem value="low" className="text-xs font-medium text-slate-400">⚪ Thấp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Người thực hiện */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Người thực hiện</Label>
            <Select 
              value={form.assigned_to} 
              onValueChange={val => setForm({ ...form, assigned_to: val })}
              disabled={!isManager}
            >
              <SelectTrigger className="rounded-xl border-slate-100 bg-slate-50 h-11 text-sm font-medium">
                <SelectValue placeholder="Chọn nhân viên thực hiện" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-48">
                {loadingStaff ? (
                  <div className="p-4 text-center text-xs text-slate-400">Đang tải...</div>
                ) : (
                  staffList.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs font-semibold">
                      👤 {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Hạn chót */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hạn chót (Due date)</Label>
            <div className="relative">
              <Input 
                type="datetime-local"
                className="rounded-xl border-slate-100 bg-slate-50 focus:bg-white text-sm font-medium h-11 pr-10"
                value={form.due_at}
                onChange={e => setForm({ ...form, due_at: e.target.value })}
              />
            </div>
          </div>

          {/* Ghi chú hướng dẫn */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú hướng dẫn</Label>
            <Textarea 
              placeholder="VD: Nhớ đề xuất chương trình khuyến mãi tháng này..." 
              className="min-h-[80px] rounded-2xl border-slate-100 bg-slate-50 focus:bg-white text-sm font-medium resize-none"
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold text-slate-400">Hủy</Button>
          <Button 
            disabled={saving}
            onClick={handleSave}
            className="rounded-xl bg-slate-900 hover:bg-black font-black px-8 h-12 shadow-lg shadow-slate-200"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang thêm...</>
            ) : (
              "Thêm việc cần làm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
