import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  AlertTriangle, 
  MapPin, 
  UserPlus, 
  PhoneCall, 
  ShieldAlert,
  Loader2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { getStaffName } from "@/lib/customerOwnership";

export function RoutingAlertsWidget() {
  const { user, isManager } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [missingSale, setMissingSale] = useState<any[]>([]);
  const [missingTele, setMissingTele] = useState<any[]>([]);
  const [missingGeo, setMissingGeo] = useState<any[]>([]);

  // States for Quick Actions
  const [staffList, setStaffList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [assignType, setAssignType] = useState<'sale' | 'tele' | null>(null);
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
          { data: resR }
        ] = await Promise.all([
          supabase.from("customers").select("id, name, facility_name, customer_distance_type").is("deleted_at", null).is("owner_sale_id", null).in("customer_distance_type", ["near_company", "same_city"]).limit(10),
          supabase.from("customers").select("id, name, facility_name, customer_distance_type").is("deleted_at", null).is("owner_tele_id", null).in("customer_distance_type", ["province", "far_city"]).limit(10),
          supabase.from("customers").select("id, name, facility_name").is("deleted_at", null).or("latitude.is.null,longitude.is.null").limit(10),
          supabase.from("profiles").select("*"),
          supabase.from("user_roles").select("*")
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
    return staffList.filter(staff => {
      const staffRoles = rolesList.filter(r => r.user_id === staff.id).map(r => r.role);
      return staffRoles.some(r => allowedRoles.includes(r) || r === 'admin' || r === 'sub_admin');
    });
  };
  
  const salesStaff = getStaffByRoles(['sale']);
  const teleStaff = getStaffByRoles(['tele_lead']);

  const handleAssignConfirm = async () => {
    if (!selectedStaffId) return toast.error("Vui lòng chọn nhân sự");
    setSaving(true);
    
    try {
      const isSale = assignType === 'sale';
      
      const updates = {
        owner_sale_id: isSale ? selectedStaffId : assignTarget.owner_sale_id,
        owner_tele_id: !isSale ? selectedStaffId : assignTarget.owner_tele_id,
        care_model: isSale ? 'sale_owned' : 'tele_owned',
        customer_channel: isSale ? 'direct_sales' : 'tele_sales',
      };
      
      const { error: updErr } = await supabase.from("customers").update(updates).eq("id", assignTarget.id);
      if (updErr) throw updErr;
      
      const staffName = staffList.find(s => s.id === selectedStaffId)?.display_name || "Nhân sự";
      const title = isSale ? "Gán Sale theo phân tuyến địa lý" : "Gán Trưởng Tele theo phân tuyến địa lý";
      const content = `Đã phân công ${isSale ? 'Direct Sale' : 'Telesale'}: ${staffName}`;
      
      await supabase.from("customer_activities").insert({
        customer_id: assignTarget.id,
        activity_type: 'handoff',
        title,
        content,
        created_by: user?.id
      });
      
      await createNotification({
        recipient_user_id: selectedStaffId,
        customer_id: assignTarget.id,
        title: "Bạn được giao Khách hàng mới",
        message: `Khách hàng ${assignTarget.facility_name || assignTarget.name} vừa được chia cho bạn từ hệ thống phân tuyến tự động.`,
        type: "lead_assigned",
        priority: "high",
        action_url: `/customers/${assignTarget.id}`,
        created_by: user?.id
      });
      
      await supabase.from("customer_tasks").insert({
        customer_id: assignTarget.id,
        title: "Follow-up khách hàng mới gán",
        description: "Khách hàng được chia từ hệ thống phân tuyến, vui lòng liên hệ và cập nhật thông tin.",
        due_date: new Date(Date.now() + 86400000).toISOString(),
        assigned_to: selectedStaffId,
        created_by: user?.id,
        status: "pending"
      });
      
      toast.success("Đã phân tuyến khách hàng thành công!");
      
      // Cập nhật lại UI nội bộ mà ko cần fetch lại
      if (isSale) {
        setMissingSale(prev => prev.filter(c => c.id !== assignTarget.id));
      } else {
        setMissingTele(prev => prev.filter(c => c.id !== assignTarget.id));
      }

      setAssignModalOpen(false);
      setAssignTarget(null);
      setSelectedStaffId("");
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setSaving(false);
    }
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
            <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">Hành động Phân tuyến</CardTitle>
          </div>
          <Badge className="bg-rose-50 text-rose-600 border-none font-black text-[10px] px-2.5">
            {totalAlerts} Cần xử lý
          </Badge>
        </CardHeader>
        
        <CardContent className="p-0 space-y-4">
          
          {/* Missing Sale */}
          {missingSale.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Khách gần cần gán Sale ({missingSale.length})</h4>
              </div>
              <div className="space-y-2">
                {missingSale.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-indigo-50 hover:border-indigo-200 transition-colors group">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800">{c.facility_name || c.name}</p>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">{c.customer_distance_type === 'near_company' ? 'Gần công ty' : 'Cùng tỉnh/thành'}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-7 text-[9px] font-black uppercase text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      onClick={() => {
                        setAssignTarget(c);
                        setAssignType('sale');
                        setSelectedStaffId("");
                        setAssignModalOpen(true);
                      }}
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
              <div className="flex items-center gap-2 mb-3">
                <PhoneCall className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">Khách xa cần gán Trưởng Tele ({missingTele.length})</h4>
              </div>
              <div className="space-y-2">
                {missingTele.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-amber-50 hover:border-amber-200 transition-colors group">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800">{c.facility_name || c.name}</p>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">{c.customer_distance_type === 'province' ? 'Ngoại tỉnh' : 'Vùng sâu/xa'}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-7 text-[9px] font-black uppercase text-amber-600 border-amber-200 hover:bg-amber-50"
                      onClick={() => {
                        setAssignTarget(c);
                        setAssignType('tele');
                        setSelectedStaffId("");
                        setAssignModalOpen(true);
                      }}
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
                <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">Cần ghim vị trí ({missingGeo.length})</h4>
              </div>
              <div className="space-y-2">
                {missingGeo.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-rose-50 hover:border-rose-200 transition-colors group">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800">{c.facility_name || c.name}</p>
                      <p className="text-[9px] text-rose-400 font-medium mt-0.5">Chưa có tọa độ bản đồ</p>
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
          customerId={previewCustomer.id}
          getStaffName={getStaffName}
        />
      )}

      {/* ASSIGN MODAL */}
      <Dialog open={assignModalOpen} onOpenChange={(open) => !saving && setAssignModalOpen(open)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6 border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight text-slate-900">
              {assignType === 'sale' ? 'Gán Sale Phụ Trách' : 'Gán Trưởng Tele'}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 uppercase mt-1 tracking-widest">
              {assignTarget?.facility_name || assignTarget?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Chọn nhân sự
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              disabled={saving}
            >
              <option value="">-- Chọn nhân sự --</option>
              {(assignType === 'sale' ? salesStaff : teleStaff).map(s => (
                <option key={s.id} value={s.id}>{s.display_name || s.email || 'Chưa rõ tên'}</option>
              ))}
            </select>
          </div>
          
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setAssignModalOpen(false)} disabled={saving} className="rounded-xl text-xs font-bold">Hủy</Button>
            <Button onClick={handleAssignConfirm} disabled={saving || !selectedStaffId} className="rounded-xl text-xs font-black uppercase bg-slate-900 hover:bg-black px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Xác nhận gán"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
