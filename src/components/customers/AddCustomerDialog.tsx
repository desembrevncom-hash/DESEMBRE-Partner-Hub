import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Building2, 
  MapPin, 
  Phone, 
  UserCircle,
  Headset,
  UserCheck,
  Target,
  Map,
  Sparkles,
  Shield,
  CalendarIcon,
  Loader2,
  Mail
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createLeadAssignedAutomation } from "@/lib/automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { normalizePhone } from "@/lib/phone";
import { 
  type CustomerChannel,
  type CustomerDistanceType,
  type CustomerCareModel,
  CUSTOMER_CHANNEL_OPTIONS,
  CUSTOMER_DISTANCE_OPTIONS,
  CARE_MODEL_OPTIONS,
  LIFECYCLE_STAGE_OPTIONS,
  DEFAULT_CUSTOMER_CHANNEL,
  DEFAULT_CUSTOMER_DISTANCE_TYPE,
  DEFAULT_CARE_MODEL,
} from "@/lib/customerOwnership";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddCustomerDialog({ open, onOpenChange, onSuccess }: AddCustomerDialogProps) {
  const { user, isSale, isTeleLead } = useAuth();
  const [saving, setSaving] = useState(false);
  
  const [salesUsers, setSalesUsers] = useState<Array<{ id: string; full_name?: string; email?: string }>>([]);
  const [teleLeads, setTeleLeads] = useState<Array<{ id: string; full_name?: string; email?: string }>>([]);

  const [form, setForm] = useState({
    name: "",
    facility_name: "",
    phone: "",
    address: "",
    customer_channel: DEFAULT_CUSTOMER_CHANNEL,
    customer_distance_type: DEFAULT_CUSTOMER_DISTANCE_TYPE,
    care_model: DEFAULT_CARE_MODEL,
    owner_sale_id: "none",
    owner_tele_id: "none",
    email: "",
    zalo: "",
    facebook: "",
    city: "",
    district: "",
    region: "",
    business_type: "SPA_CLINIC",
    business_size: "medium",
    main_service: "",
    skin_concern_focus: "",
    interested_products: "",
    current_brands: "",
    monthly_purchase_potential: 0,
    decision_maker: "",
    decision_role: "OWNER",
    preferred_contact_channel: "ZALO",
    source: "FACEBOOK",
    status: "new",
    potential_level: "warm",
    note: "",
    tags: [] as string[],
    marketing_opt_in: false,
    tax_code: "",
    bed_count: 0,
    staff_count: 0,
    tech_equipment: "",
    decision_maker_dob: "",
    lifecycle_stage: "new_lead",
    personality_trait: "",
  });

  // Reset form when opening
  useEffect(() => {
    if (open) {
      let defaultOwnerSaleId = "none";
      let defaultOwnerTeleId = "none";
      let defaultChannel = DEFAULT_CUSTOMER_CHANNEL;
      let defaultCareModel = DEFAULT_CARE_MODEL;

      if (isSale) {
        defaultOwnerSaleId = user?.id || "none";
      } else if (isTeleLead) {
        defaultOwnerTeleId = user?.id || "none";
        defaultChannel = "tele_sales" as CustomerChannel;
        defaultCareModel = "tele_owned" as CustomerCareModel;
      }

      setForm({
        name: "",
        facility_name: "",
        phone: "",
        address: "",
        customer_channel: defaultChannel,
        customer_distance_type: DEFAULT_CUSTOMER_DISTANCE_TYPE,
        care_model: defaultCareModel,
        owner_sale_id: defaultOwnerSaleId,
        owner_tele_id: defaultOwnerTeleId,
        email: "",
        zalo: "",
        facebook: "",
        city: "",
        district: "",
        region: "",
        business_type: "SPA_CLINIC",
        business_size: "medium",
        main_service: "",
        skin_concern_focus: "",
        interested_products: "",
        current_brands: "",
        monthly_purchase_potential: 0,
        decision_maker: "",
        decision_role: "OWNER",
        preferred_contact_channel: "ZALO",
        source: "FACEBOOK",
        status: "new",
        potential_level: "warm",
        note: "",
        tags: [],
        marketing_opt_in: false,
        tax_code: "",
        bed_count: 0,
        staff_count: 0,
        tech_equipment: "",
        decision_maker_dob: "",
        lifecycle_stage: "new_lead",
        personality_trait: "",
      });
    }
  }, [open, user, isSale, isTeleLead]);

  useEffect(() => {
    async function fetchStaff() {
      try {
        const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
        if (!rolesData) return;
        const { data: profilesData } = await supabase.from("profiles").select("id, full_name, display_name, email");
        
        const profMap = new Map();
        if (profilesData) {
          profilesData.forEach(p => profMap.set(p.id, {
            id: p.id,
            full_name: p.full_name || p.display_name || p.email,
            email: p.email
          }));
        }

        const sList: any[] = [];
        const tlList: any[] = [];
        rolesData.forEach(ur => {
          const p = profMap.get(ur.user_id);
          if (!p) return;
          if (ur.role === "sale") sList.push(p);
          else if (ur.role === "tele_lead") tlList.push(p);
        });
        setSalesUsers(sList);
        setTeleLeads(tlList);
      } catch (e) { /* ignore */ }
    }
    fetchStaff();
  }, []);

  const handleSave = async () => {
    if (!form.facility_name.trim() && !form.name.trim()) {
      toast.error("Vui lòng nhập Tên cơ sở hoặc Tên liên hệ");
      return;
    }
    
    setSaving(true);
    const norm = normalizePhone(form.phone) || null;
    if (norm) {
      const { data: existing, error: checkError } = await supabase
        .from("customers")
        .select("id, facility_name, name")
        .eq("normalized_phone", norm)
        .is("deleted_at", null)
        .limit(1);
      
      if (!checkError && existing && existing.length > 0) {
        const confirmSave = window.confirm(
          `⚠️ CẢNH BÁO TRÙNG LẶP DỮ LIỆU!\n\nSố điện thoại chuẩn hóa (${norm}) đã tồn tại trên một khách hàng đang hoạt động:\n- Tên/Cơ sở: ${existing[0].facility_name || existing[0].name}\n\nBạn có chắc chắn vẫn muốn lưu thêm khách hàng này không?`
        );
        if (!confirmSave) {
          setSaving(false);
          return;
        }
      }
    }

    const payload: any = {
      name: form.name.trim(),
      facility_name: form.facility_name.trim(),
      contact_name: form.name.trim(),
      business_name: form.facility_name.trim(),
      phone: form.phone.trim(),
      normalized_phone: norm,
      address: form.address.trim(),
      customer_channel: form.customer_channel,
      customer_distance_type: form.customer_distance_type,
      care_model: form.care_model,
      owner_sale_id: form.owner_sale_id !== "none" ? form.owner_sale_id : null,
      owner_tele_id: form.owner_tele_id !== "none" ? form.owner_tele_id : null,
      email: form.email,
      zalo: form.zalo,
      facebook: form.facebook,
      city: form.city,
      district: form.district,
      region: form.region,
      business_type: form.business_type,
      business_size: form.business_size,
      main_service: form.main_service,
      skin_concern_focus: form.skin_concern_focus,
      interested_products: form.interested_products,
      current_brands: form.current_brands,
      monthly_purchase_potential: form.monthly_purchase_potential,
      decision_maker: form.decision_maker,
      decision_role: form.decision_role,
      preferred_contact_channel: form.preferred_contact_channel,
      source: form.source,
      status: form.status,
      potential_level: form.potential_level,
      note: form.note,
      tags: form.tags,
      marketing_opt_in: form.marketing_opt_in,
      created_by: user?.id,
      lifecycle_stage: form.lifecycle_stage === "new_lead" && (form.owner_sale_id !== "none" || form.owner_tele_id !== "none") ? "assigned" : form.lifecycle_stage,
      bed_count: form.bed_count,
      staff_count: form.staff_count,
      tech_equipment: form.tech_equipment,
      spa_equipment: (() => {
        const equipments: string[] = [];
        const techLower = form.tech_equipment.toLowerCase();
        if (techLower.includes("laser") || techLower.includes("co2") || techLower.includes("yag")) equipments.push("laser");
        if (techLower.includes("hifu") || techLower.includes("nâng cơ")) equipments.push("hifu");
        if (techLower.includes("phi kim") || techLower.includes("lăn kim") || techLower.includes("needle")) equipments.push("needle");
        if (techLower.includes("rf") || techLower.includes("giảm béo")) equipments.push("rf");
        return equipments;
      })(),
    };

    const { data: newCustomer, error } = await supabase.from("customers").insert([payload]).select().single();
    
    if (error) {
      if (error.code === "23505") {
        toast.error("Số điện thoại này đã tồn tại trên hệ thống. Vui lòng kiểm tra lại!");
      } else {
        toast.error("Lỗi: " + error.message);
      }
    } else {
      // Trigger Automation if assigned
      if (newCustomer) {
        if (payload.owner_sale_id) {
           await createLeadAssignedAutomation(
             newCustomer.id, 
             newCustomer.facility_name || newCustomer.name, 
             payload.owner_sale_id, 
             user?.display_name || user?.email || "Hệ thống",
             user?.id || ""
           );
        }
        if (payload.owner_tele_id && payload.owner_tele_id !== payload.owner_sale_id) {
           await createLeadAssignedAutomation(
             newCustomer.id, 
             newCustomer.facility_name || newCustomer.name, 
             payload.owner_tele_id, 
             user?.display_name || user?.email || "Hệ thống",
             user?.id || ""
           );
        }
      }

      toast.success("Đã thêm khách hàng thành công!");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden rounded-[28px] border-none shadow-2xl">
        <DialogHeader className="px-8 pt-8 pb-6 bg-slate-900 text-white relative">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30 backdrop-blur-md">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight">Thêm Khách hàng</DialogTitle>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Hồ sơ & Phân tuyến ownership</p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 bg-white">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid grid-cols-4 gap-2 bg-slate-100/50 p-1 rounded-2xl mb-8">
              <TabsTrigger value="profile" className="rounded-xl text-[10px] font-black uppercase py-2">Hồ sơ</TabsTrigger>
              <TabsTrigger value="business" className="rounded-xl text-[10px] font-black uppercase py-2">Kinh doanh</TabsTrigger>
              <TabsTrigger value="dm" className="rounded-xl text-[10px] font-black uppercase py-2">Quyết định</TabsTrigger>
              <TabsTrigger value="care" className="rounded-xl text-[10px] font-black uppercase py-2">Chăm sóc</TabsTrigger>
            </TabsList>

            <div className="max-h-[50vh] overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-slate-200">
              <TabsContent value="profile" className="space-y-6 mt-0">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Building2 className="w-3.5 h-3.5 text-primary/70" /> Tên cơ sở (Spa/Clinic) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.facility_name}
                      onChange={(e) => setForm({ ...form, facility_name: e.target.value })}
                      placeholder="VD: Desembre Premium Clinic"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <UserCircle className="w-3.5 h-3.5 text-primary/70" /> Người liên hệ
                    </Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="VD: Chị Lan Anh"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>

                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Phone className="w-3.5 h-3.5 text-primary/70" /> Số điện thoại
                    </Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="0912345678"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm font-mono focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <MapPin className="w-3.5 h-3.5 text-primary/70" /> Địa chỉ chi tiết
                    </Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Số nhà, tên đường, phường/xã..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Map className="w-3.5 h-3.5 text-primary/70" /> Tỉnh / Thành phố
                    </Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Hà Nội, TP.HCM..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Shield className="w-3.5 h-3.5 text-primary/70" /> Mã số thuế (B2B)
                    </Label>
                    <Input
                      value={form.tax_code}
                      onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
                      placeholder="MST doanh nghiệp"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm font-mono focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="business" className="space-y-6 mt-0">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Quy mô (Số giường)</Label>
                    <Input
                      type="number"
                      value={form.bed_count}
                      onChange={(e) => setForm({ ...form, bed_count: parseInt(e.target.value) || 0 })}
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Số lượng nhân sự</Label>
                    <Input
                      type="number"
                      value={form.staff_count}
                      onChange={(e) => setForm({ ...form, staff_count: parseInt(e.target.value) || 0 })}
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Chuyên môn tập trung
                    </Label>
                    <Input
                      value={form.main_service}
                      onChange={(e) => setForm({ ...form, main_service: e.target.value })}
                      placeholder="VD: Nám, mụn, trẻ hóa..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Thiết bị công nghệ</Label>
                    <Input
                      value={form.tech_equipment}
                      onChange={(e) => setForm({ ...form, tech_equipment: e.target.value })}
                      placeholder="VD: Laser, HIFU, Phi kim..."
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="dm" className="space-y-6 mt-0">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Tên người quyết định</Label>
                    <Input
                      value={form.decision_maker}
                      onChange={(e) => setForm({ ...form, decision_maker: e.target.value })}
                      placeholder="Họ tên Chủ Spa"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Vai trò</Label>
                    <Select value={form.decision_role} onValueChange={(v) => setForm({ ...form, decision_role: v })}>
                      <SelectTrigger className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                        <SelectItem value="OWNER" className="text-sm font-medium">Chủ sở hữu</SelectItem>
                        <SelectItem value="MANAGER" className="text-sm font-medium">Quản lý điều hành</SelectItem>
                        <SelectItem value="DOCTOR" className="text-sm font-medium">Bác sĩ chuyên trách</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Mail className="w-3.5 h-3.5 text-blue-400" /> Email liên hệ
                    </Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="example@gmail.com"
                      className="text-sm h-11 rounded-2xl border-slate-200/60 shadow-sm"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="care" className="space-y-6 mt-0">
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Kênh tiếp cận</Label>
                      <Select value={form.customer_channel} onValueChange={(v: any) => setForm({ ...form, customer_channel: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          {CUSTOMER_CHANNEL_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-sm font-medium">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Khoảng cách công ty</Label>
                      <Select value={form.customer_distance_type} onValueChange={(v: any) => setForm({ ...form, customer_distance_type: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          {CUSTOMER_DISTANCE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-sm font-medium">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Mô hình chăm sóc</Label>
                      <Select value={form.care_model} onValueChange={(v: any) => setForm({ ...form, care_model: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-bold text-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          {CARE_MODEL_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-sm font-bold">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Sale phụ trách
                      </Label>
                      <Select value={form.owner_sale_id} onValueChange={(v) => setForm({ ...form, owner_sale_id: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-medium">
                          <SelectValue placeholder="Chọn nhân sự Sale" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          <SelectItem value="none" className="text-sm italic text-slate-400">— Chưa phân công —</SelectItem>
                          {salesUsers.map(u => (
                            <SelectItem key={u.id} value={u.id} className="text-sm font-medium">👤 {u.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                        <Headset className="w-3.5 h-3.5 text-amber-600" /> Tele phụ trách
                      </Label>
                      <Select value={form.owner_tele_id} onValueChange={(v) => setForm({ ...form, owner_tele_id: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-medium">
                          <SelectValue placeholder={teleLeads.length > 0 ? "Chọn Trưởng Tele phụ trách..." : "Chưa có tài khoản Trưởng Tele"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          <SelectItem value="none" className="text-sm italic text-slate-400">— Chưa phân công —</SelectItem>
                          {teleLeads.map(u => (
                            <SelectItem key={u.id} value={u.id} className="text-sm font-medium">🎧 {u.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Trạng thái khách
                      </Label>
                      <Select value={form.lifecycle_stage} onValueChange={(v) => setForm({ ...form, lifecycle_stage: v })}>
                        <SelectTrigger className="text-sm h-11 rounded-2xl bg-white border-slate-200/60 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                          {LIFECYCLE_STAGE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-sm font-bold">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="px-8 py-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            disabled={saving} 
            className="text-xs h-11 px-6 rounded-2xl font-bold text-slate-500"
          >
            Hủy bỏ
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="text-xs h-11 px-8 rounded-2xl font-black bg-slate-900 hover:bg-primary text-white shadow-lg transition-all"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            HOÀN TẤT THÊM MỚI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
