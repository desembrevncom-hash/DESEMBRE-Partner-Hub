import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertTriangle,
  MapPin,
  UserPlus,
  PhoneCall,
  ShieldAlert,
  Loader2,
  CheckSquare,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";

import { Checkbox } from "@/components/ui/checkbox";

export function RoutingAlertsWidget() {
  const { user, isManager } = useAuth();

  const [loading, setLoading] = useState(true);
  const [missingSale, setMissingSale] = useState<any[]>([]);
  const [missingTele, setMissingTele] = useState<any[]>([]);
  const [missingGeo, setMissingGeo] = useState<any[]>([]);

  // Batch Selection States
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [selectedTeleIds, setSelectedTeleIds] = useState<string[]>([]);

  // States for Quick Actions
  const [staffList, setStaffList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  // assignTargets is now an array of customers
  const [assignTargets, setAssignTargets] = useState<any[]>([]);
  const [assignType, setAssignType] = useState<"sale" | "tele" | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [saving, setSaving] = useState(false);

  const [previewCustomer, setPreviewCustomer] = useState<any>(null);

  useEffect(() => {
    if (!isManager) return;

    const fetchAlertsAndStaff = async () => {
      setLoading(true);
      try {
        const [
          { data: saleData },
          { data: teleData },
          { data: geoData },
          { data: resP },
          { data: resR },
        ] = await Promise.all([
          supabase
            .from("customers")
            .select("id, name, facility_name, customer_distance_type")
            .is("deleted_at", null)
            .is("owner_sale_id", null)
            .in("customer_distance_type", ["near_company", "same_city"])
            .limit(50),
          supabase
            .from("customers")
            .select("id, name, facility_name, customer_distance_type")
            .is("deleted_at", null)
            .is("owner_tele_id", null)
            .in("customer_distance_type", ["province", "far_city"])
            .limit(50),
          supabase
            .from("customers")
            .select("id, name, facility_name")
            .is("deleted_at", null)
            .or("latitude.is.null,longitude.is.null")
            .limit(50),
          supabase.from("profiles").select("*"),
          supabase.from("user_roles").select("*"),
        ]);

        setMissingSale(saleData || []);
        setMissingTele(teleData || []);
        setMissingGeo(geoData || []);
        if (resP) setStaffList(resP);
        if (resR) setRolesList(resR);
      } catch (err) {
        console.error("Error fetching routing alerts:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertsAndStaff();
  }, [isManager]);

  const getStaffByRoles = (allowedRoles: string[]) => {
    return staffList.filter((staff) => {
      const staffRoles = rolesList.filter((r) => r.user_id === staff.id).map((r) => r.role);
      return staffRoles.some((r) => allowedRoles.includes(r) || r === "admin" || r === "sub_admin");
    });
  };

  const salesStaff = getStaffByRoles(["sale"]);
  const teleStaff = getStaffByRoles(["tele_lead"]);

  const toggleSelectSale = (id: string) => {
    setSelectedSaleIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleSelectTele = (id: string) => {
    setSelectedTeleIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const openBatchAssignModal = (type: "sale" | "tele") => {
    const ids = type === "sale" ? selectedSaleIds : selectedTeleIds;
    const sourceList = type === "sale" ? missingSale : missingTele;
    const targets = sourceList.filter((c) => ids.includes(c.id));

    if (targets.length === 0) return;

    setAssignTargets(targets);
    setAssignType(type);
    setSelectedStaffId("");
    setAssignModalOpen(true);
  };

  const openSingleAssignModal = (customer: any, type: "sale" | "tele") => {
    setAssignTargets([customer]);
    setAssignType(type);
    setSelectedStaffId("");
    setAssignModalOpen(true);
  };

  const handleAssignConfirm = async () => {
    if (!selectedStaffId) return toast.error("Vui lòng chọn nhân sự");
    setSaving(true);

    let successCount = 0;
    let failedCount = 0;
    const failedNames: string[] = [];

    const isSale = assignType === "sale";
    const staffName = staffList.find((s) => s.id === selectedStaffId)?.display_name || "Nhân sự";
    const title = isSale
      ? "Gán Sale theo phân tuyến địa lý"
      : "Gán Trưởng Tele theo phân tuyến địa lý";
    const content = `Đã phân công ${isSale ? "Direct Sale" : "Telesale"}: ${staffName}`;

    for (const target of assignTargets) {
      try {
        const updates = {
          owner_sale_id: isSale ? selectedStaffId : target.owner_sale_id,
          owner_tele_id: !isSale ? selectedStaffId : target.owner_tele_id,
          care_model: isSale ? "sale_owned" : "tele_owned",
          customer_channel: isSale ? "direct_sales" : "tele_sales",
        };

        const { error: updErr } = await supabase
          .from("customers")
          .update(updates)
          .eq("id", target.id);
        if (updErr) throw updErr;

        await supabase.from("customer_activities").insert({
          customer_id: target.id,
          activity_type: "handoff",
          title,
          content,
          created_by: user?.id,
        });

        await createNotification({
          recipient_user_id: selectedStaffId,
          entity_id: target.id,
          entity_type: "customer",
          title: "Bạn được giao Khách hàng mới",
          message: `Khách hàng ${target.facility_name || target.name} vừa được chia cho bạn từ hệ thống phân tuyến.`,
          type: "lead_assigned",
          priority: "high",
          action_url: `/customers/${target.id}`,
          created_by: user?.id,
        });

        await supabase.from("customer_tasks").insert({
          customer_id: target.id,
          title: "Follow-up khách hàng mới gán",
          description:
            "Khách hàng được chia từ hệ thống phân tuyến, vui lòng liên hệ và cập nhật thông tin.",
          due_date: new Date(Date.now() + 86400000).toISOString(),
          assigned_to: selectedStaffId,
          created_by: user?.id,
          status: "pending",
        });

        successCount++;
      } catch (err: any) {
        console.error(`Failed to assign customer ${target.id}:`, err);
        failedCount++;
        failedNames.push(target.facility_name || target.name);
      }
    }

    setSaving(false);

    if (failedCount === 0) {
      toast.success(`Đã phân tuyến thành công ${successCount} khách hàng!`);
    } else {
      toast.warning(
        `Hoàn tất với lỗi. Thành công: ${successCount}. Thất bại: ${failedCount}. (Khách lỗi: ${failedNames.join(", ")})`,
        { duration: 8000 },
      );
    }

    // Cleanup UI
    const assignedIds = assignTargets.map((t) => t.id);
    if (isSale) {
      setMissingSale((prev) => prev.filter((c) => !assignedIds.includes(c.id)));
      setSelectedSaleIds((prev) => prev.filter((id) => !assignedIds.includes(id)));
    } else {
      setMissingTele((prev) => prev.filter((c) => !assignedIds.includes(c.id)));
      setSelectedTeleIds((prev) => prev.filter((id) => !assignedIds.includes(id)));
    }

    setAssignModalOpen(false);
    setAssignTargets([]);
    setSelectedStaffId("");
  };

  if (!isManager) return null;

  const totalAlerts = missingSale.length + missingTele.length + missingGeo.length;

  if (loading) {
    return (
      <Card className="rounded-[40px] border-none shadow-sm bg-white p-8 animate-pulse">
        <div className="h-6 w-1/3 bg-slate-200 rounded-lg mb-6"></div>
        <div className="space-y-4">
          <div className="h-16 w-full bg-slate-100 rounded-2xl"></div>
          <div className="h-16 w-full bg-slate-100 rounded-2xl"></div>
        </div>
      </Card>
    );
  }

  if (totalAlerts === 0) {
    return null;
  }

  return (
    <>
      <Card className="rounded-[40px] border-none shadow-sm bg-white p-8">
        <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">
              Hành động Phân tuyến
            </CardTitle>
          </div>
          <Badge className="bg-rose-50 text-rose-600 border-none font-black text-[10px] px-2.5">
            {totalAlerts} Cần xử lý
          </Badge>
        </CardHeader>

        <CardContent className="p-0 space-y-4">
          {/* Missing Sale */}
          {missingSale.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">
                    Khách gần cần gán Sale ({missingSale.length})
                  </h4>
                </div>
                {selectedSaleIds.length > 0 && (
                  <Button
                    size="sm"
                    className="h-7 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5"
                    onClick={() => openBatchAssignModal("sale")}
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Gán {selectedSaleIds.length} khách
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {missingSale.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-indigo-50 hover:border-indigo-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedSaleIds.includes(c.id)}
                        onCheckedChange={() => toggleSelectSale(c.id)}
                        className="border-indigo-300 data-[state=checked]:bg-indigo-600"
                      />
                      <div>
                        <p className="text-[11px] font-bold text-slate-800">
                          {c.facility_name || c.name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                          {c.customer_distance_type === "near_company"
                            ? "Gần công ty"
                            : "Cùng tỉnh/thành"}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[9px] font-black uppercase text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      onClick={() => openSingleAssignModal(c, "sale")}
                    >
                      Gán Sale
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Tele */}
          {missingTele.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                    Khách xa cần gán Trưởng Tele ({missingTele.length})
                  </h4>
                </div>
                {selectedTeleIds.length > 0 && (
                  <Button
                    size="sm"
                    className="h-7 text-[10px] font-black uppercase bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5"
                    onClick={() => openBatchAssignModal("tele")}
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Gán {selectedTeleIds.length} khách
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {missingTele.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-amber-50 hover:border-amber-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedTeleIds.includes(c.id)}
                        onCheckedChange={() => toggleSelectTele(c.id)}
                        className="border-amber-300 data-[state=checked]:bg-amber-600"
                      />
                      <div>
                        <p className="text-[11px] font-bold text-slate-800">
                          {c.facility_name || c.name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                          {c.customer_distance_type === "province" ? "Ngoại tỉnh" : "Vùng sâu/xa"}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[9px] font-black uppercase text-amber-600 border-amber-200 hover:bg-amber-50"
                      onClick={() => openSingleAssignModal(c, "tele")}
                    >
                      Gán Tele
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Geo */}
          {missingGeo.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-rose-600" />
                <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">
                  Cần ghim vị trí ({missingGeo.length})
                </h4>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {missingGeo.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-rose-50 hover:border-rose-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[11px] font-bold text-slate-800">
                          {c.facility_name || c.name}
                        </p>
                        <p className="text-[9px] text-rose-400 font-medium mt-0.5">
                          Chưa có tọa độ bản đồ
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[9px] font-black uppercase text-rose-600 border-rose-200 hover:bg-rose-50"
                      onClick={() => setPreviewCustomer(c)}
                    >
                      Mở khách
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CUSTOMER PREVIEW (For missing GEO) */}
      {previewCustomer && (
        <CustomerPreviewDrawer
          open={!!previewCustomer}
          onOpenChange={(open) => !open && setPreviewCustomer(null)}
          customer={previewCustomer}
        />
      )}

      {/* ASSIGN MODAL */}
      <Dialog open={assignModalOpen} onOpenChange={(open) => !saving && setAssignModalOpen(open)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6 border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight text-slate-900">
              {assignType === "sale" ? "Gán Sale Phụ Trách" : "Gán Trưởng Tele"}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 uppercase mt-1 tracking-widest">
              Bạn đang gán {assignTargets.length} khách cho{" "}
              {assignType === "sale" ? "Sale" : "Trưởng Tele"}. Thao tác này sẽ tạo thông báo, nhắc
              lịch task và activity cho từng khách.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Chọn nhân sự nhận {assignTargets.length} khách
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              disabled={saving}
            >
              <option value="">-- Chọn nhân sự --</option>
              {(assignType === "sale" ? salesStaff : teleStaff).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name || s.email || "Chưa rõ tên"}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              onClick={() => setAssignModalOpen(false)}
              disabled={saving}
              className="rounded-xl text-xs font-bold"
            >
              Hủy
            </Button>
            <Button
              onClick={handleAssignConfirm}
              disabled={saving || !selectedStaffId}
              className="rounded-xl text-xs font-black uppercase bg-slate-900 hover:bg-black px-6"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Xác nhận gán ${assignTargets.length} khách`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
