import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  User,
  Phone,
  Calendar,
  Star,
  StarOff,
  Mail,
  MessageSquare,
  AlertCircle,
  Info,
  Check,
  X,
  ShieldAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Contact {
  id: string;
  customer_id: string;
  full_name: string;
  role_title: string | null;
  phone: string | null;
  zalo_phone: string | null;
  birthday_day: number | null;
  birthday_month: number | null;
  birthday_year: number | null;
  birthday_reminder_enabled: boolean;
  birthday_offer_opt_in: boolean;
  preferred_channel: "none" | "zalo" | "phone" | "email" | "other";
  is_primary: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomerContactsProps {
  customerId: string;
}

const PREFERRED_CHANNEL_LABELS: Record<string, string> = {
  none: "Không có",
  zalo: "Zalo",
  phone: "Điện thoại",
  email: "Email",
  other: "Khác",
};

export function CustomerContacts({ customerId }: CustomerContactsProps) {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modals / Form state
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    roleTitle: "",
    phone: "",
    zaloPhone: "",
    bDay: "",
    bMonth: "",
    bYear: "",
    birthdayReminderEnabled: true,
    birthdayOfferOptIn: false,
    preferredChannel: "none" as Contact["preferred_channel"],
    isPrimary: false,
    note: "",
  });

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_contacts")
        .select("*")
        .eq("customer_id", customerId)
        .order("is_primary", { ascending: false })
        .order("full_name", { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (err: unknown) {
      console.error("Error fetching contacts:", err);
      toast.error("Không thể lấy danh sách người liên hệ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const openAddDialog = () => {
    setEditingContact(null);
    setForm({
      fullName: "",
      roleTitle: "",
      phone: "",
      zaloPhone: "",
      bDay: "",
      bMonth: "",
      bYear: "",
      birthdayReminderEnabled: true,
      birthdayOfferOptIn: false,
      preferredChannel: "none",
      isPrimary: false,
      note: "",
    });
    setShowFormDialog(true);
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      fullName: contact.full_name || "",
      roleTitle: contact.role_title || "",
      phone: contact.phone || "",
      zaloPhone: contact.zalo_phone || "",
      bDay: contact.birthday_day ? contact.birthday_day.toString() : "",
      bMonth: contact.birthday_month ? contact.birthday_month.toString() : "",
      bYear: contact.birthday_year ? contact.birthday_year.toString() : "",
      birthdayReminderEnabled: contact.birthday_reminder_enabled,
      birthdayOfferOptIn: contact.birthday_offer_opt_in,
      preferredChannel: contact.preferred_channel || "none",
      isPrimary: contact.is_primary,
      note: contact.note || "",
    });
    setShowFormDialog(true);
  };

  // Validation function matching DB rules
  const validateForm = () => {
    if (!form.fullName.trim()) {
      toast.error("Vui lòng nhập họ tên người liên hệ");
      return false;
    }

    const day = form.bDay ? parseInt(form.bDay) : null;
    const month = form.bMonth ? parseInt(form.bMonth) : null;
    const year = form.bYear ? parseInt(form.bYear) : null;

    // Both present or both null rule
    if ((day === null && month !== null) || (day !== null && month === null)) {
      toast.error("Ngày và tháng sinh nhật phải cùng có giá trị hoặc cùng trống");
      return false;
    }

    if (month !== null && day !== null) {
      if (month < 1 || month > 12) {
        toast.error("Tháng sinh nhật không hợp lệ (phải từ 1 đến 12)");
        return false;
      }
      if (day < 1 || day > 31) {
        toast.error("Ngày sinh nhật không hợp lệ (phải từ 1 đến 31)");
        return false;
      }

      // Check day limit for months
      if ([4, 6, 9, 11].includes(month) && day > 30) {
        toast.error(`Tháng ${month} chỉ có tối đa 30 ngày`);
        return false;
      }

      if (month === 2 && day > 29) {
        toast.error("Tháng 2 chỉ có tối đa 29 ngày (năm nhuận)");
        return false;
      }
    }

    if (year !== null) {
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear) {
        toast.error(`Năm sinh nhật phải từ 1900 đến ${currentYear}`);
        return false;
      }
    }

    return true;
  };

  const handleSaveContact = async () => {
    if (!validateForm()) return;
    setSaving(true);

    try {
      const day = form.bDay ? parseInt(form.bDay) : null;
      const month = form.bMonth ? parseInt(form.bMonth) : null;
      const year = form.bYear ? parseInt(form.bYear) : null;

      // 1. If setting as primary, unset other primaries for the same customer to avoid conflict
      if (form.isPrimary) {
        const { error: unsetErr } = await supabase
          .from("customer_contacts")
          .update({ is_primary: false })
          .eq("customer_id", customerId)
          .eq("is_primary", true);

        if (unsetErr) {
          console.warn("Could not unset other primary contacts:", unsetErr);
        }
      }

      const payload = {
        customer_id: customerId,
        full_name: form.fullName.trim(),
        role_title: form.roleTitle.trim() || null,
        phone: form.phone.trim() || null,
        zalo_phone: form.zaloPhone.trim() || null,
        birthday_day: day,
        birthday_month: month,
        birthday_year: year,
        birthday_reminder_enabled: form.birthdayReminderEnabled,
        birthday_offer_opt_in: form.birthdayOfferOptIn,
        preferred_channel: form.preferredChannel,
        is_primary: form.isPrimary,
        note: form.note.trim() || null,
      };

      if (editingContact) {
        // Update
        const { error } = await supabase
          .from("customer_contacts")
          .update(payload)
          .eq("id", editingContact.id);

        if (error) throw error;
        toast.success("Cập nhật người liên hệ thành công!");
      } else {
        // Insert
        const { error } = await supabase.from("customer_contacts").insert(payload);

        if (error) throw error;
        toast.success("Thêm người liên hệ thành công!");
      }

      setShowFormDialog(false);
      fetchContacts();
      // Dispatch event to reload customer activities/timeline if listening
      window.dispatchEvent(new Event("customer_timeline_refresh"));
    } catch (err: unknown) {
      console.error("Error saving contact:", err);
      toast.error((err as Error).message || "Không thể lưu thông tin người liên hệ");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!isAdmin && !isSubAdmin) {
      toast.error("Chỉ Quản trị viên (Admin/Sub-admin) mới có quyền xóa người liên hệ!");
      return;
    }

    const confirm = window.confirm("Bạn có chắc chắn muốn xóa người liên hệ này?");
    if (!confirm) return;

    setDeletingId(id);
    try {
      const { error } = await supabase.from("customer_contacts").delete().eq("id", id);

      if (error) throw error;
      toast.success("Xóa người liên hệ thành công!");
      fetchContacts();
      window.dispatchEvent(new Event("customer_timeline_refresh"));
    } catch (err: unknown) {
      console.error("Error deleting contact:", err);
      toast.error((err as Error).message || "Không thể xóa người liên hệ do lỗi bảo mật RLS");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-black text-slate-800 uppercase flex items-center gap-1.5">
          <User className="w-4 h-4 text-primary" /> NGƯỜI LIÊN HỆ ({contacts.length})
        </h3>
        <Button
          size="sm"
          onClick={openAddDialog}
          className="h-8 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-primary"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Thêm người liên hệ
        </Button>
      </div>

      {/* ── Main List ── */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-sm text-slate-400 italic px-4 py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">
          Chưa có thông tin người liên hệ tại Spa này.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              className={`p-4 rounded-2xl border bg-white hover:shadow-md transition-all relative overflow-hidden ${
                c.is_primary ? "border-indigo-300 ring-2 ring-indigo-50" : "border-slate-200"
              }`}
            >
              {/* Header Info */}
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-950">{c.full_name}</span>
                    {c.role_title && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                        {c.role_title}
                      </span>
                    )}
                    {c.is_primary && (
                      <Badge className="bg-indigo-600 text-white border-none text-[9px] px-1.5 py-0.2">
                        <Star className="w-2.5 h-2.5 mr-0.5 fill-white" /> Liên hệ chính
                      </Badge>
                    )}
                  </div>

                  {/* Communication channels */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1 text-[11px] font-medium text-slate-600">
                    {c.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.zalo_phone && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] leading-none">💬</span>
                        <span>Zalo: {c.zalo_phone}</span>
                      </div>
                    )}
                    {c.birthday_month && c.birthday_day && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-bold text-slate-800">
                          Sinh nhật: {c.birthday_day.toString().padStart(2, "0")}/
                          {c.birthday_month.toString().padStart(2, "0")}
                          {c.birthday_year ? `/${c.birthday_year}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CRUD Action Buttons */}
                <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-xl border border-slate-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-slate-500 hover:text-indigo-600 hover:bg-slate-200"
                    onClick={() => openEditDialog(c)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  {(isAdmin || isSubAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDeleteContact(c.id)}
                      disabled={deletingId === c.id}
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Badges/Settings state footer */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 text-[10px] font-bold text-slate-500">
                <span className="mr-1">Thiết lập:</span>
                <Badge
                  className={`border-none px-2 py-0.5 text-[9px] ${
                    c.birthday_reminder_enabled
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {c.birthday_reminder_enabled ? "✓ Nhắc sinh nhật" : "✕ Tắt nhắc sinh nhật"}
                </Badge>

                <Badge
                  className={`border-none px-2 py-0.5 text-[9px] ${
                    c.birthday_offer_opt_in
                      ? "bg-indigo-50 text-indigo-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {c.birthday_offer_opt_in ? "✓ Nhận ưu đãi" : "✕ Chưa nhận ưu đãi"}
                </Badge>

                <Badge className="bg-slate-100 text-slate-700 border-none px-2 py-0.5 text-[9px]">
                  Kênh ưu tiên: {PREFERRED_CHANNEL_LABELS[c.preferred_channel]}
                </Badge>
              </div>

              {/* Note */}
              {c.note && (
                <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                  <span className="font-extrabold text-[10px] text-slate-600 block uppercase mb-0.5">
                    Ghi chú:
                  </span>
                  {c.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Dialog Form ── */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-md rounded-3xl p-5 md:p-6 gap-4 w-[calc(100%-32px)]">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900">
              {editingContact ? "Cập nhật người liên hệ" : "Thêm người liên hệ mới"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Nhập thông tin người liên hệ tại cơ sở Spa để quản lý và tự động hóa nhắc sinh nhật
              nội bộ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 max-h-[calc(100dvh-12rem)] md:max-h-[60vh] overflow-y-auto pr-1">
            {/* Họ tên */}
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-500 uppercase">Họ và tên *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Ví dụ: Nguyễn Thị Lan"
                className="h-11 md:h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Chức vụ */}
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-500 uppercase">
                  Chức vụ / Vai trò
                </Label>
                <Input
                  value={form.roleTitle}
                  onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
                  placeholder="Chủ Spa, Quản lý..."
                  className="h-11 md:h-9 text-xs rounded-xl"
                />
              </div>

              {/* Kênh ưu tiên */}
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-500 uppercase">
                  Kênh liên hệ ưu tiên
                </Label>
                <Select
                  value={form.preferredChannel}
                  onValueChange={(v: Contact["preferred_channel"]) =>
                    setForm({ ...form, preferredChannel: v })
                  }
                >
                  <SelectTrigger className="h-11 md:h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không có</SelectItem>
                    <SelectItem value="zalo">Zalo</SelectItem>
                    <SelectItem value="phone">Điện thoại</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="other">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Điện thoại */}
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-500 uppercase">
                  Số điện thoại
                </Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="09xxx..."
                  className="h-11 md:h-9 text-xs rounded-xl"
                />
              </div>

              {/* Điện thoại Zalo */}
              <div className="space-y-1">
                <Label className="text-[10px] font-black text-slate-500 uppercase">
                  Số Zalo liên kết
                </Label>
                <Input
                  value={form.zaloPhone}
                  onChange={(e) => setForm({ ...form, zaloPhone: e.target.value })}
                  placeholder="09xxx..."
                  className="h-11 md:h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* Sinh nhật (Day/Month/Year) */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-500 uppercase block">
                Sinh nhật (Ngày / Tháng / Năm)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={form.bDay}
                  onChange={(e) => setForm({ ...form, bDay: e.target.value })}
                  placeholder="Ngày"
                  className="h-11 md:h-9 text-xs rounded-xl text-center"
                />
                <Select value={form.bMonth} onValueChange={(v) => setForm({ ...form, bMonth: v })}>
                  <SelectTrigger className="h-11 md:h-9 text-xs rounded-xl px-2">
                    <SelectValue placeholder="Tháng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Trống</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        Tháng {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear().toString()}
                  value={form.bYear}
                  onChange={(e) => setForm({ ...form, bYear: e.target.value })}
                  placeholder="Năm (Tùy chọn)"
                  className="h-11 md:h-9 text-xs rounded-xl text-center"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Lưu ý: Phải điền cả Ngày và Tháng hoặc để trống cả hai. Ngày 29/02 được hỗ trợ.
              </p>
            </div>

            {/* Switches */}
            <div className="space-y-3.5 pt-2 border-t border-slate-100">
              {/* Nhắc nhở sinh nhật nội bộ */}
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-slate-800">
                    Kích hoạt nhắc nhở sinh nhật
                  </Label>
                  <p className="text-[10px] text-slate-400">
                    Tự động tạo nhiệm vụ cho Sales trước sinh nhật 7 ngày.
                  </p>
                </div>
                <Switch
                  checked={form.birthdayReminderEnabled}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, birthdayReminderEnabled: checked })
                  }
                />
              </div>

              {/* Đồng ý nhận ưu đãi */}
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-slate-800">
                    Khách đồng ý nhận ưu đãi
                  </Label>
                  <p className="text-[10px] text-slate-400">
                    Xác nhận khách đồng ý nhận ưu đãi sinh nhật tiếp thị qua Zalo/email sau này.
                  </p>
                </div>
                <Switch
                  checked={form.birthdayOfferOptIn}
                  onCheckedChange={(checked) => setForm({ ...form, birthdayOfferOptIn: checked })}
                />
              </div>

              {/* Set as Primary Contact */}
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="form-is-primary"
                  checked={form.isPrimary}
                  onCheckedChange={(checked) => setForm({ ...form, isPrimary: !!checked })}
                  className="rounded-md border-slate-300 w-5 h-5 shrink-0 mt-0.5"
                />
                <div className="grid gap-0.5 leading-none">
                  <label
                    htmlFor="form-is-primary"
                    className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5"
                  >
                    Đặt làm người liên hệ chính
                  </label>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Một Spa chỉ có tối đa một người liên hệ chính nhận thông báo mặc định.
                  </p>
                </div>
              </div>
            </div>

            {/* Ghi chú */}
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-500 uppercase">Ghi chú</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Ghi chú sở thích, thói quen hoặc thông tin đặc biệt của khách hàng..."
                className="text-xs rounded-xl min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100 flex flex-row items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFormDialog(false)}
              className="h-11 md:h-9 text-xs font-bold rounded-xl"
            >
              Hủy
            </Button>
            <Button
              onClick={handleSaveContact}
              disabled={saving}
              className="h-11 md:h-9 text-xs font-bold rounded-xl bg-slate-900 hover:bg-primary text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Lưu thay đổi
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
