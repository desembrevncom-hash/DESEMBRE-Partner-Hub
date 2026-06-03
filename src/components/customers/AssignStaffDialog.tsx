import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Users, PhoneCall, Briefcase, Sparkles } from "lucide-react";
import { CARE_MODEL_OPTIONS } from "@/lib/customerOwnership";
import { createNotification } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";

interface AssignStaffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any;
  onSuccess: () => void;
}

export function AssignStaffDialog({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: AssignStaffDialogProps) {
  const { user, isAdmin, isSubAdmin, isTeleLead } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);

  const [saleId, setSaleId] = useState<string>(customer?.owner_sale_id || "");
  const [teleId, setTeleId] = useState<string>(customer?.owner_tele_id || "");
  const [careModel, setCareModel] = useState<string>(customer?.care_model || "sale_owned");
  const [initialDemand, setInitialDemand] = useState<string>(customer?.note || "");

  useEffect(() => {
    if (isOpen) {
      setSaleId(customer?.owner_sale_id || "");
      setTeleId(customer?.owner_tele_id || "");
      setCareModel(customer?.care_model || "sale_owned");
      setInitialDemand(customer?.note || "");
      fetchStaff();
    }
  }, [isOpen, customer]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const [resP, resR] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);

      if (resP.data) setStaffList(resP.data);
      if (resR.data) setRolesList(resR.data);
    } catch (e) {
      console.error(e);
      toast.error("Lỗi tải danh sách nhân sự");
    } finally {
      setLoading(false);
    }
  };

  const getStaffByRoles = (allowedRoles: string[]) => {
    return staffList.filter((staff) => {
      const staffRoles = rolesList.filter((r) => r.user_id === staff.id).map((r) => r.role);
      // Admin and sub_admin can take any lead, or specifically the allowed roles
      return staffRoles.some((r) => allowedRoles.includes(r) || r === "admin" || r === "sub_admin");
    });
  };

  const salesStaff = getStaffByRoles(["sale"]);
  const teleStaff = getStaffByRoles(["tele_lead", "telesale"]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {
        owner_sale_id: saleId || null,
        owner_tele_id: teleId || null,
        care_model: careModel,
        note: initialDemand.trim() || null,
      };

      // Tự động chuyển trạng thái sang "assigned" (Đã nhận lead) nếu được phân công và đang ở trạng thái lead mới
      if (
        (saleId || teleId) &&
        (customer?.lifecycle_stage === "new_lead" || !customer?.lifecycle_stage)
      ) {
        updates.lifecycle_stage = "assigned";
      }

      const { error } = await supabase.from("customers").update(updates).eq("id", customer.id);

      if (error) throw error;

      // Lưu nhật ký bàn giao nếu có sự thay đổi người phụ trách (Sale/Tele) hoặc thay đổi ghi chú
      const isSaleChanged = (saleId || null) !== (customer?.owner_sale_id || null);
      const isTeleChanged = (teleId || null) !== (customer?.owner_tele_id || null);
      const isNoteChanged = initialDemand.trim() !== (customer?.note || "");

      if (isSaleChanged || isTeleChanged || (initialDemand.trim() && isNoteChanged)) {
        const contentParts = [];
        if (isSaleChanged) {
          const oldSale =
            staffList.find((s) => s.id === customer?.owner_sale_id)?.display_name || "Chưa gán";
          const newSale = staffList.find((s) => s.id === saleId)?.display_name || "Chưa gán";
          contentParts.push(`Thay đổi Direct Sale: từ "${oldSale}" sang "${newSale}"`);
        }
        if (isTeleChanged) {
          const oldTele =
            staffList.find((s) => s.id === customer?.owner_tele_id)?.display_name || "Chưa gán";
          const newTele = staffList.find((s) => s.id === teleId)?.display_name || "Chưa gán";
          contentParts.push(`Thay đổi Telesale: từ "${oldTele}" sang "${newTele}"`);
        }
        if (initialDemand.trim() && isNoteChanged) {
          contentParts.push(`Ghi chú bàn giao mới: "${initialDemand.trim()}"`);
        }

        const { error: actError } = await supabase.from("customer_activities").insert({
          customer_id: customer.id,
          activity_type: "handoff",
          title: "Bàn giao & Luân chuyển nhân sự phụ trách",
          content: contentParts.join("\n"),
          created_by: user?.id,
        });
        if (actError) console.error("Handoff activity log error:", actError);
      }

      // Gửi thông báo cho Sale nếu được chọn mới
      if (saleId && saleId !== customer.owner_sale_id) {
        const notifRes = await createNotification({
          recipient_user_id: saleId,
          title: "Bạn được giao Khách hàng mới",
          message: `Khách hàng ${customer.business_name || customer.name} vừa được chia cho bạn phụ trách (Direct Sale).`,
          type: "lead_assigned",
          priority: "high",
          action_url: `/customers/${customer.id}`,
          created_by: user?.id,
        });
        if (notifRes.error) console.error("Sale notif error:", notifRes.error);
      }

      // Gửi thông báo cho Tele nếu được chọn mới
      if (teleId && teleId !== customer.owner_tele_id) {
        const notifRes = await createNotification({
          recipient_user_id: teleId,
          title: "Bạn được giao Khách hàng mới",
          message: `Khách hàng ${customer.business_name || customer.name} vừa được chia cho bạn hỗ trợ (Telesale).`,
          type: "lead_assigned",
          priority: "high",
          action_url: `/customers/${customer.id}`,
          created_by: user?.id,
        });
        if (notifRes.error) console.error("Tele notif error:", notifRes.error);
      }

      toast.success("Đã cập nhật luồng chăm sóc & người phụ trách");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Lỗi cập nhật: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-slate-900 px-8 py-6 text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <DialogTitle className="text-lg font-black tracking-tight">
              Phân tuyến Khách hàng
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {customer?.business_name || customer?.name}
            </DialogDescription>
          </div>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="p-8 space-y-6 bg-slate-50">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5" /> Mô hình chăm sóc (Care Model)
              </label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl h-12 px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={careModel}
                onChange={(e) => setCareModel(e.target.value)}
              >
                {CARE_MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Direct Sale
                </label>
                <select
                  className="w-full bg-white border border-slate-200 rounded-xl h-12 px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-50 disabled:bg-slate-50"
                  value={saleId}
                  onChange={(e) => setSaleId(e.target.value)}
                  disabled={!isAdmin && !isSubAdmin}
                >
                  <option value="">-- Chưa gán --</option>
                  {salesStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name || s.email || "Chưa rõ tên"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5" /> Telesale Hub
                </label>
                <select
                  className="w-full bg-white border border-slate-200 rounded-xl h-12 px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-50 disabled:bg-slate-50"
                  value={teleId}
                  onChange={(e) => setTeleId(e.target.value)}
                  disabled={!isAdmin && !isSubAdmin && !isTeleLead}
                >
                  <option value="">-- Chưa gán --</option>
                  {teleStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name || s.email || "Chưa rõ tên"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Nhu cầu đầu tiên / Ghi chú bàn
                giao
              </label>
              <textarea
                className="w-full min-h-[90px] bg-white border border-slate-200 rounded-2xl p-4 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none placeholder:text-slate-300"
                placeholder="Ví dụ: Khách đang quan tâm bộ mỹ phẩm trị mụn ẩn, muốn làm đại lý và hỏi chính sách chiết khấu..."
                value={initialDemand}
                onChange={(e) => setInitialDemand(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="p-6 bg-white border-t border-slate-100 flex items-center justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest px-6"
            disabled={saving}
          >
            Hủy
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-xl bg-slate-900 hover:bg-black font-black uppercase text-[10px] tracking-widest px-8 shadow-lg shadow-slate-200"
            disabled={saving || loading}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Lưu Thay Đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
