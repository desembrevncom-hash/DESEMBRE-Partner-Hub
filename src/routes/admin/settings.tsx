import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PRODUCTS, CATEGORIES } from "@/data/products";
import { 
  Settings, 
  Palette, 
  Globe, 
  ShieldCheck, 
  Building2, 
  Mail, 
  Phone, 
  CreditCard, 
  Bell, 
  Lock, 
  Save, 
  ArrowLeft, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  Monitor,
  Moon,
  Sun,
  Database,
  Languages,
  Zap,
  Image as ImageIcon,
  Users,
  RefreshCw,
  Clock,
  Search,
  PackageCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  const { user, isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [cycleSearch, setCycleSearch] = useState("");
  // productCycles: { [productId]: { retail?: number; salon?: number } }
  const [productCycles, setProductCycles] = useState<Record<number, { retail?: number; salon?: number }>>({});
  
  const [config, setConfig] = useState<any>({
    id: null,
    companyName: "DESEMBRE VIETNAM",
    address: "Tầng 5, Tòa nhà Luxury, 123 Kim Mã, Ba Đình, Hà Nội",
    supportEmail: "support@desembre.vn",
    supportPhone: "1900 6868",
    vatRate: 10,
    defaultDiscount: 35,
    enableNotifications: true,
    darkMode: false,
    systemLanguage: "vi",
    primaryColor: "#6366f1",
    accentColor: "#ec4899",
    logoLightUrl: "",
    logoDarkUrl: "",
    leadOverdueDays: 3,
    goldThreshold: 50000000,
    goldDiscount: 62,
    diamondThreshold: 100000000,
    diamondDiscount: 65,
    refillCycleDays: 60
  });
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from('system_settings').select('*').maybeSingle();
      
      const savedTier = localStorage.getItem('system_tier_settings');
      const tierSettings = savedTier ? JSON.parse(savedTier) : {
        goldThreshold: 50000000,
        goldDiscount: 62,
        diamondThreshold: 100000000,
        diamondDiscount: 65,
        refillCycleDays: 60
      };

      if (data) {
        setConfig({
          id: data.id,
          companyName: data.company_name || "",
          address: data.address || "",
          supportEmail: data.support_email || "",
          supportPhone: data.support_phone || "",
          vatRate: data.vat_rate || 10,
          defaultDiscount: data.default_discount || 35,
          enableNotifications: data.enable_notifications ?? true,
          darkMode: data.dark_mode ?? false,
          systemLanguage: data.system_language || "vi",
          primaryColor: data.primary_color || "#6366f1",
          accentColor: data.accent_color || "#ec4899",
          logoLightUrl: data.logo_light_url || "",
          logoDarkUrl: data.logo_dark_url || "",
          leadOverdueDays: data.lead_overdue_days ?? 3,
          ...tierSettings
        });
      } else {
        setConfig((prev: any) => ({
          ...prev,
          ...tierSettings
        }));
      }
      setLoadingConfig(false);
    }
    // Load per-product cycle settings from localStorage
    const savedCycles = localStorage.getItem('product_cycle_settings');
    if (savedCycles) {
      try { setProductCycles(JSON.parse(savedCycles)); } catch {}
    }
    loadConfig();
  }, []);

  const handleLogoUpload = async (file: File, type: 'light' | 'dark') => {
    if (!file) return;
    try {
      toast.loading("Đang tải ảnh lên...", { id: "upload-logo" });
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${type}-${Math.random()}.${fileExt}`;
      const filePath = `brand/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setConfig((prev: any) => ({
        ...prev,
        [type === 'light' ? 'logoLightUrl' : 'logoDarkUrl']: publicUrl
      }));
      toast.success("Tải ảnh lên thành công!", { id: "upload-logo" });
    } catch (error: any) {
      toast.error("Lỗi tải ảnh: " + error.message, { id: "upload-logo" });
    }
  };

  const handleSave = async () => {
    setBusy(true);
    
    const tierSettings = {
      goldThreshold: Number(config.goldThreshold),
      goldDiscount: Number(config.goldDiscount),
      diamondThreshold: Number(config.diamondThreshold),
      diamondDiscount: Number(config.diamondDiscount),
      refillCycleDays: Number(config.refillCycleDays)
    };
    localStorage.setItem('system_tier_settings', JSON.stringify(tierSettings));
    // Save per-product cycle settings
    localStorage.setItem('product_cycle_settings', JSON.stringify(productCycles));

    const payload = {
      company_name: config.companyName,
      address: config.address,
      support_email: config.supportEmail,
      support_phone: config.supportPhone,
      vat_rate: Number(config.vatRate),
      default_discount: Number(config.defaultDiscount),
      enable_notifications: config.enableNotifications,
      dark_mode: config.darkMode,
      system_language: config.systemLanguage,
      primary_color: config.primaryColor,
      accent_color: config.accentColor,
      logo_light_url: config.logoLightUrl,
      logo_dark_url: config.logoDarkUrl,
      lead_overdue_days: Number(config.leadOverdueDays)
    };

    let error;
    if (config.id) {
      const res = await supabase.from('system_settings').update(payload).eq('id', config.id);
      error = res.error;
    } else {
      const res = await supabase.from('system_settings').insert([payload]);
      error = res.error;
    }

    setBusy(false);
    if (error) {
      toast.error("Lỗi cập nhật cấu hình: " + error.message);
    } else {
      toast.success("Đã cập nhật cấu hình hệ thống thành công!");
    }
  };

  const handleCycleChange = (productId: number, variantType: 'retail' | 'salon', days: number) => {
    setProductCycles(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [variantType]: days }
    }));
  };

  const handleResetCycle = (productId: number, variantType?: 'retail' | 'salon') => {
    setProductCycles(prev => {
      const next = { ...prev };
      if (variantType) {
        if (next[productId]) {
          const updated = { ...next[productId] };
          delete updated[variantType];
          if (Object.keys(updated).length === 0) {
            delete next[productId];
          } else {
            next[productId] = updated;
          }
        }
      } else {
        delete next[productId];
      }
      return next;
    });
  };
  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      {/* HEADER */}
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
             <Link to="/workspace" className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200">
                <ArrowLeft className="w-5 h-5" />
             </Link>
             <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Cấu hình Hệ thống</h1>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                   <ShieldCheck className="w-3 h-3 fill-indigo-500" /> Global Branding & Policies
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <Button 
              onClick={handleSave}
              disabled={busy}
              className="rounded-xl bg-slate-900 hover:bg-black font-black text-xs h-10 px-8 shadow-lg shadow-slate-200 transition-all hover:scale-105"
             >
                <Save className="w-4 h-4 mr-2" /> {busy ? "Đang lưu..." : "Lưu thay đổi"}
             </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Tabs defaultValue="branding" className="space-y-8">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-2 rounded-[24px] shadow-sm border border-slate-100 overflow-x-auto">
              <TabsList className="bg-transparent h-auto p-0 flex gap-2 flex-wrap">
                 <TabTrigger value="branding" icon={Palette} label="Thương hiệu" />
                 <TabTrigger value="company" icon={Building2} label="Doanh nghiệp" />
                 <TabTrigger value="rules" icon={CreditCard} label="Quy tắc Bán hàng" />
                 <TabTrigger value="products" icon={PackageCheck} label="Chu kỳ Sản phẩm" />
                 <TabTrigger value="system" icon={Monitor} label="Hệ thống" />
                 <TabTrigger value="security" icon={Lock} label="Bảo mật" />
                 <TabTrigger value="users" icon={Users} label="Nhân sự" />
              </TabsList>
           </div>

           {/* BRANDING TAB */}
           <TabsContent value="branding">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 space-y-8">
                    <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                       <CardHeader className="p-8 pb-4">
                          <CardTitle className="text-lg font-black text-slate-900">Nhận diện Thương hiệu</CardTitle>
                          <CardDescription>Tùy chỉnh Logo và màu sắc đại diện cho DESEMBRE</CardDescription>
                       </CardHeader>
                       <CardContent className="p-8 pt-4 space-y-8">
                          <div className="flex flex-col md:flex-row gap-12 items-center">
                             <div className="space-y-4 text-center">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Logo Chính (Light)</label>
                                <label className="w-32 h-32 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-4 group hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden block mx-auto">
                                   <input type="file" className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) handleLogoUpload(e.target.files[0], 'light'); }} />
                                   {config.logoLightUrl ? (
                                     <img src={config.logoLightUrl} alt="Logo Light" className="w-full h-full object-contain" />
                                   ) : (
                                     <>
                                       <ImageIcon className="w-8 h-8 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                       <p className="text-[9px] font-bold text-slate-400 mt-2">1024x1024 px</p>
                                     </>
                                   )}
                                </label>
                             </div>
                             <div className="space-y-4 text-center">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Logo Phụ (Dark)</label>
                                <label className="w-32 h-32 rounded-3xl bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-4 group hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden block mx-auto">
                                   <input type="file" className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) handleLogoUpload(e.target.files[0], 'dark'); }} />
                                   {config.logoDarkUrl ? (
                                     <img src={config.logoDarkUrl} alt="Logo Dark" className="w-full h-full object-contain" />
                                   ) : (
                                     <>
                                       <ImageIcon className="w-8 h-8 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                       <p className="text-[9px] font-bold text-slate-500 mt-2">White Version</p>
                                     </>
                                   )}
                                </label>
                             </div>
                             <div className="flex-1 space-y-6">
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Màu chủ đạo (Primary Color)</Label>
                                   <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 rounded-xl shadow-lg shadow-indigo-100" style={{ backgroundColor: config.primaryColor }}></div>
                                      <Input value={config.primaryColor} onChange={e => setConfig({...config, primaryColor: e.target.value})} className="h-10 rounded-xl font-mono text-sm uppercase" />
                                   </div>
                                </div>
                                <div className="space-y-2">
                                   <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Màu nhấn (Accent Color)</Label>
                                   <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 rounded-xl shadow-lg shadow-pink-100" style={{ backgroundColor: config.accentColor }}></div>
                                      <Input value={config.accentColor} onChange={e => setConfig({...config, accentColor: e.target.value})} className="h-10 rounded-xl font-mono text-sm uppercase" />
                                   </div>
                                </div>
                             </div>
                          </div>
                       </CardContent>
                    </Card>
                 </div>
                 
                 <div className="space-y-8">
                    <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                       <CardHeader className="p-8">
                          <CardTitle className="text-base font-black text-slate-900">Xem trước (UI Preview)</CardTitle>
                          <CardDescription>Giao diện sẽ thay đổi theo cấu hình màu sắc</CardDescription>
                       </CardHeader>
                       <CardContent className="px-8 pb-8 flex flex-col items-center justify-center space-y-6">
                          <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: config.primaryColor }}></div>
                                <div className="space-y-1 flex-1">
                                   <div className="h-2 w-20 bg-slate-200 rounded"></div>
                                   <div className="h-1.5 w-32 bg-slate-100 rounded"></div>
                                </div>
                             </div>
                             <div className="h-8 w-full rounded-xl" style={{ backgroundColor: config.primaryColor }}></div>
                          </div>
                          <p className="text-[10px] text-slate-400 text-center italic">Đây là ví dụ về cách màu sắc hiển thị trên Dashboard của nhân viên.</p>
                       </CardContent>
                    </Card>
                 </div>
              </div>
           </TabsContent>

           {/* COMPANY TAB */}
           <TabsContent value="company">
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white max-w-3xl mx-auto">
                 <CardHeader className="p-8">
                    <CardTitle className="text-lg font-black text-slate-900">Thông tin Pháp lý</CardTitle>
                    <CardDescription>Thông tin này sẽ xuất hiện trên Hợp đồng và Hóa đơn</CardDescription>
                 </CardHeader>
                 <CardContent className="p-8 pt-0 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2 md:col-span-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên công ty đầy đủ</Label>
                          <Input value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value})} className="h-12 rounded-xl font-bold" />
                       </div>
                       <div className="space-y-2 md:col-span-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Địa chỉ trụ sở chính</Label>
                          <Input value={config.address} onChange={e => setConfig({...config, address: e.target.value})} className="h-12 rounded-xl" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email hỗ trợ</Label>
                          <Input value={config.supportEmail} onChange={e => setConfig({...config, supportEmail: e.target.value})} className="h-12 rounded-xl" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hotline tổng đài</Label>
                          <Input value={config.supportPhone} onChange={e => setConfig({...config, supportPhone: e.target.value})} className="h-12 rounded-xl" />
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </TabsContent>

           {/* RULES TAB */}
           <TabsContent value="rules">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                 <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                    <CardHeader className="p-8">
                       <CardTitle className="text-lg font-black text-slate-900">Tài chính & Thuế</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-6">
                       <div className="space-y-4">
                          <div className="flex items-center justify-between">
                             <div className="space-y-1">
                                <p className="text-sm font-black text-slate-900">Tỷ lệ VAT mặc định</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Áp dụng cho mọi đơn hàng mới</p>
                             </div>
                             <div className="flex items-center gap-2">
                                <Input value={config.vatRate} onChange={e => setConfig({...config, vatRate: e.target.value})} className="w-20 h-10 rounded-xl text-center font-bold" type="number" />
                                <span className="font-black text-slate-400">%</span>
                             </div>
                          </div>
                          <div className="flex items-center justify-between">
                             <div className="space-y-1">
                                <p className="text-sm font-black text-slate-900">Chiết khấu Đại lý cơ sở</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Áp dụng khi chưa có hạng mức riêng</p>
                             </div>
                             <div className="flex items-center gap-2">
                                <Input value={config.defaultDiscount} onChange={e => setConfig({...config, defaultDiscount: e.target.value})} className="w-20 h-10 rounded-xl text-center font-bold" type="number" />
                                <span className="font-black text-slate-400">%</span>
                             </div>
                          </div>
                       </div>
                    </CardContent>
                 </Card>

                 <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                    <CardHeader className="p-8">
                       <CardTitle className="text-lg font-black text-slate-900">Tự động hóa (Automations)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-6">
                       <div className="space-y-4">
                          <div className="flex items-center justify-between">
                             <div className="space-y-1">
                                <p className="text-sm font-black text-slate-900">Gửi Mail khi có Đơn hàng</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Thông báo tự động cho khách</p>
                             </div>
                             <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                             <div className="space-y-1">
                                <p className="text-sm font-black text-slate-900">Thời gian cảnh báo quá hạn</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Thời gian (ngày) Lead báo giá bị bỏ quên</p>
                             </div>
                             <div className="flex items-center gap-2">
                                <Input value={config.leadOverdueDays} onChange={e => setConfig({...config, leadOverdueDays: e.target.value})} className="w-20 h-10 rounded-xl text-center font-bold" type="number" />
                                <span className="font-black text-slate-400">ngày</span>
                             </div>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
                  {/* CARD 3: Cấu hình Phân hạng Đại lý */}
                  <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                     <CardHeader className="p-8">
                        <CardTitle className="text-lg font-black text-slate-900">Cấu hình Hạng thành viên Spa</CardTitle>
                     </CardHeader>
                     <CardContent className="p-8 pt-0 space-y-6">
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                 <p className="text-sm font-black text-slate-900">Doanh số tối thiểu đạt GOLD</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ngưỡng LTV tích lũy để thăng hạng Gold</p>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Input value={config.goldThreshold || ""} onChange={e => setConfig({...config, goldThreshold: e.target.value})} className="w-32 h-10 rounded-xl text-right font-bold" type="number" />
                                 <span className="font-black text-slate-400">đ</span>
                              </div>
                           </div>
                           <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                 <p className="text-sm font-black text-slate-900">Chiết khấu đặc quyền GOLD</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Chiết khấu gối đầu cho đại lý Gold</p>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Input value={config.goldDiscount || ""} onChange={e => setConfig({...config, goldDiscount: e.target.value})} className="w-20 h-10 rounded-xl text-center font-bold" type="number" />
                                 <span className="font-black text-slate-400">%</span>
                              </div>
                           </div>
                           <div className="border-t border-slate-100 my-4"></div>
                           <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                 <p className="text-sm font-black text-slate-900">Doanh số tối thiểu đạt DIAMOND</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ngưỡng LTV tích lũy để thăng hạng Diamond</p>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Input value={config.diamondThreshold || ""} onChange={e => setConfig({...config, diamondThreshold: e.target.value})} className="w-32 h-10 rounded-xl text-right font-bold" type="number" />
                                 <span className="font-black text-slate-400">đ</span>
                              </div>
                           </div>
                           <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                 <p className="text-sm font-black text-slate-900">Chiết khấu đặc quyền DIAMOND</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Chiết khấu gối đầu cho đại lý Diamond</p>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Input value={config.diamondDiscount || ""} onChange={e => setConfig({...config, diamondDiscount: e.target.value})} className="w-20 h-10 rounded-xl text-center font-bold" type="number" />
                                 <span className="font-black text-slate-400">%</span>
                              </div>
                           </div>
                        </div>
                     </CardContent>
                  </Card>

                  {/* CARD 4: Cảnh báo chu kỳ cạn kiệt */}
                  <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                     <CardHeader className="p-8">
                        <CardTitle className="text-lg font-black text-slate-900">Cảnh báo Refill & Cạn kiệt</CardTitle>
                     </CardHeader>
                     <CardContent className="p-8 pt-0 space-y-6">
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                 <p className="text-sm font-black text-slate-900">Chu kỳ sử dụng hết mỹ phẩm</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Số ngày ước lượng chu kỳ tiêu thụ của Spa</p>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Input value={config.refillCycleDays || ""} onChange={e => setConfig({...config, refillCycleDays: e.target.value})} className="w-24 h-10 rounded-xl text-center font-bold" type="number" />
                                 <span className="font-black text-slate-400">ngày</span>
                              </div>
                           </div>
                           <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-[11px] font-medium text-amber-800 leading-relaxed">
                              💡 <strong>Mẹo vận hành:</strong> CRM sẽ tự động đếm ngược từ ngày chốt đơn thành công gần nhất. Khi thời gian sử dụng còn dưới 10 ngày (Ví dụ: đã trôi qua {Number(config.refillCycleDays || 60) - 10} ngày), hệ thống sẽ hiển thị thẻ cảnh báo tái đặt hàng trên Workspace để nhân viên Sale gọi điện Upsell gối đầu!
                           </div>
                        </div>
                     </CardContent>
                  </Card>
               </div>
            </TabsContent>

           {/* PRODUCT CYCLES TAB */}
           <TabsContent value="products">
              <div className="space-y-6 max-w-6xl mx-auto">
                 <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                    <CardContent className="p-8">
                       <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                             <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Clock className="w-7 h-7" />
                             </div>
                             <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Bảng Chu kỳ Refill theo Sản phẩm</h2>
                                <p className="text-sm font-medium text-slate-500 mt-1">Cấu hình số ngày tiêu thụ hết sản phẩm riêng lẻ cho từng SKU. Mặc định dùng chu kỳ toàn cục ({config.refillCycleDays} ngày).</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                             <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black text-[10px] px-4 py-2 rounded-xl">
                                {Object.values(productCycles).reduce((acc, v) => acc + Object.keys(v).length, 0)} variant đã cấu hình
                             </Badge>
                             <Button variant="outline" size="sm" className="rounded-xl border-red-100 text-red-500 hover:bg-red-50 font-bold text-xs" onClick={() => { setProductCycles({}); toast.success("Đã reset toàn bộ chu kỳ sản phẩm về mặc định"); }}>
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset tất cả
                             </Button>
                          </div>
                       </div>
                       <div className="relative mt-6">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input placeholder="Tìm tên sản phẩm..." className="pl-11 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white font-medium" value={cycleSearch} onChange={e => setCycleSearch(e.target.value)} />
                       </div>
                       <div className="mt-5 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-[11px] font-medium text-indigo-800 leading-relaxed">
                          💡 <strong>Cách hoạt động:</strong> Khi một sản phẩm được chốt đơn thành công, hệ thống bắt đầu đếm ngược theo chu kỳ này. Khi còn &lt; 10 ngày, thẻ Upsell sẽ xuất hiện trên màn hình nhân viên Sale để nhắc gọi điện gối đầu.
                       </div>
                    </CardContent>
                 </Card>
                 {CATEGORIES.map(cat => {
                    const catProducts = PRODUCTS.filter(p =>
                       p.categoryId === cat.id &&
                       (cycleSearch === '' || p.name.toLowerCase().includes(cycleSearch.toLowerCase()))
                    );
                    if (catProducts.length === 0) return null;
                    return (
                       <Card key={cat.id} className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                          <CardHeader className="px-8 pt-6 pb-0">
                             <div className="flex items-center gap-3">
                                <div className="w-2 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                                <div>
                                   <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">{cat.name}</CardTitle>
                                   {cat.nameVi && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{cat.nameVi}</p>}
                                </div>
                                <Badge variant="outline" className="ml-auto border-slate-200 text-slate-400 text-[10px] font-black">{catProducts.length} sản phẩm</Badge>
                             </div>
                          </CardHeader>
                          <CardContent className="p-0 mt-4">
                             <table className="w-full">
                                <thead>
                                   <tr className="border-y border-slate-100 bg-slate-50/60">
                                      <th className="px-8 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU &amp; Tên sản phẩm</th>
                                      <th className="px-8 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Dung tích</th>
                                      <th className="px-8 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Chu kỳ mặc định</th>
                                      <th className="px-8 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Chu kỳ riêng (ngày)</th>
                                      <th className="px-8 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {catProducts.flatMap(p => {
                                       const retail = p.variants.find(v => v.type === 'retail');
                                       const salon = p.variants.find(v => v.type === 'salon');
                                       const hasBothSizes = !!(retail && salon);
                                       const cycleEntry = productCycles[p.id] || {};
                                       const isAnyCustomized = Object.keys(cycleEntry).length > 0;

                                       type VRow = { v: { size: string; price: number; type: string; id: string } | undefined; vType: 'retail' | 'salon'; label: string; colorClass: string; bgClass: string; borderClass: string };
                                       const variantRows: VRow[] = [];
                                       if (retail) variantRows.push({ v: retail, vType: 'retail', label: 'RETAIL', colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' });
                                       if (salon) variantRows.push({ v: salon, vType: 'salon', label: 'SALON', colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' });

                                       return variantRows.map((row, rowIdx) => {
                                          const customCycle = cycleEntry[row.vType];
                                          const isCustomized = customCycle !== undefined;
                                          const isFirst = rowIdx === 0;
                                          const isLast = rowIdx === variantRows.length - 1;
                                          const rowBorderClass = !isLast ? 'border-b border-dashed border-slate-100' : '';

                                          return (
                                             <tr key={p.id + '-' + row.vType} className={'transition-all ' + (isCustomized ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50')}>
                                                {isFirst && (
                                                   <td className="px-8 py-4 align-middle" rowSpan={variantRows.length}>
                                                      <div className="flex items-center gap-3">
                                                         <div className={'w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ' + (isAnyCustomized ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500')}>{p.id}</div>
                                                         <div>
                                                            <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug max-w-[280px]">{p.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: DES-{String(p.id).padStart(3,'0')}</p>
                                                            {hasBothSizes && (
                                                               <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md mt-1.5 inline-block tracking-wider">2 SIZE</span>
                                                            )}
                                                         </div>
                                                      </div>
                                                   </td>
                                                )}

                                                <td className={'px-6 py-3.5 text-center ' + rowBorderClass}>
                                                   <div className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-[10px] uppercase ' + row.bgClass + ' ' + row.borderClass + ' ' + row.colorClass}>
                                                      <span>{row.label}</span>
                                                      <span className="opacity-50">·</span>
                                                      <span>{row.v?.size}</span>
                                                   </div>
                                                </td>

                                                <td className={'px-6 py-3.5 text-center ' + rowBorderClass}>
                                                   <span className="text-sm font-black text-slate-400">{config.refillCycleDays} ngày</span>
                                                </td>

                                                <td className={'px-6 py-3.5 text-center ' + rowBorderClass}>
                                                   <div className="flex items-center justify-center gap-2">
                                                      <Input
                                                         type="number"
                                                         min={1}
                                                         max={365}
                                                         placeholder={String(config.refillCycleDays)}
                                                         value={customCycle ?? ''}
                                                         onChange={e => {
                                                            const val = parseInt(e.target.value);
                                                            if (!isNaN(val) && val > 0) handleCycleChange(p.id, row.vType, val);
                                                            else if (e.target.value === '') handleResetCycle(p.id, row.vType);
                                                         }}
                                                         className={'w-24 h-9 rounded-xl text-center font-black text-sm transition-all ' + (isCustomized ? 'border-indigo-300 bg-white text-indigo-700 shadow-sm shadow-indigo-100 ring-1 ring-indigo-200' : 'border-slate-200 bg-slate-50 text-slate-600')}
                                                      />
                                                      <span className="text-xs font-bold text-slate-400">ngày</span>
                                                      {isCustomized && (
                                                         <button onClick={() => handleResetCycle(p.id, row.vType)} title="Về mặc định" className="w-6 h-6 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 flex items-center justify-center transition-all">
                                                            <RefreshCw className="w-3 h-3" />
                                                         </button>
                                                      )}
                                                   </div>
                                                </td>

                                                <td className={'px-6 py-3.5 text-center ' + rowBorderClass}>
                                                   {isCustomized ? (
                                                      <Badge className={'text-white border-none text-[9px] font-black px-2.5 py-1 rounded-full ' + (row.vType === 'retail' ? 'bg-blue-600' : 'bg-purple-600')}>
                                                         ✦ {row.label}
                                                      </Badge>
                                                   ) : (
                                                      <Badge variant="outline" className="border-slate-200 text-slate-400 text-[9px] font-black px-2.5 py-1 rounded-full">
                                                         MẶC ĐỊNH
                                                      </Badge>
                                                   )}
                                                </td>
                                             </tr>
                                          );
                                       });
                                    })}
                                 </tbody>
                             </table>
                          </CardContent>
                       </Card>
                    );
                 })}
              </div>
           </TabsContent>

           {/* SYSTEM TAB */}
           <TabsContent value="system">
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white max-w-3xl mx-auto">
                 <CardHeader className="p-8">
                    <CardTitle className="text-lg font-black text-slate-900">Tùy chọn Hệ thống</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 pt-0 space-y-8">
                    <div className="space-y-6">
                       <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600">
                                <Languages className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900">Ngôn ngữ mặc định</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ngôn ngữ cho toàn bộ nhân viên</p>
                             </div>
                          </div>
                          <select className="bg-transparent font-bold text-sm outline-none" value={config.systemLanguage} onChange={e => setConfig({...config, systemLanguage: e.target.value})}>
                             <option value="vi">Tiếng Việt (VN)</option>
                             <option value="en">English (US)</option>
                             <option value="kr">Korean (KR)</option>
                          </select>
                       </div>

                       <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-amber-500">
                                <Sun className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900">Chế độ giao diện (Dark Mode)</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tùy chỉnh theo môi trường làm việc</p>
                             </div>
                          </div>
                          <Switch 
                            checked={config.darkMode} 
                            onCheckedChange={checked => setConfig({...config, darkMode: checked})} 
                          />
                       </div>

                       <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-pink-500">
                                <Bell className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900">Thông báo Đẩy (Push Notifications)</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cảnh báo tức thời trên trình duyệt</p>
                             </div>
                          </div>
                          <Switch 
                            checked={config.enableNotifications} 
                            onCheckedChange={checked => setConfig({...config, enableNotifications: checked})} 
                          />
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </TabsContent>

           {/* SECURITY TAB */}
           <TabsContent value="security">
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white max-w-3xl mx-auto">
                 <CardHeader className="p-8">
                    <CardTitle className="text-lg font-black text-slate-900">Bảo mật & Quyền riêng tư</CardTitle>
                    <CardDescription>Các thiết lập bảo mật cấp cao (Sắp ra mắt trong phiên bản tới)</CardDescription>
                 </CardHeader>
                 <CardContent className="p-8 pt-0 space-y-6">
                    <div className="space-y-4">
                       <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 opacity-70">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-500">
                                <ShieldCheck className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900">Xác thực 2 bước (2FA)</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bắt buộc với Admin & Sub-admin</p>
                             </div>
                          </div>
                          <Switch disabled checked={false} />
                       </div>
                       
                       <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 opacity-70">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-rose-500">
                                <Lock className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900">Chính sách Mật khẩu mạnh</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Yêu cầu chữ hoa, số và ký tự đặc biệt</p>
                             </div>
                          </div>
                          <Switch disabled checked={true} />
                       </div>

                       <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 opacity-70">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500">
                                <Monitor className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900">Tự động đăng xuất (Timeout)</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Khi không có hoạt động quá 30 phút</p>
                             </div>
                          </div>
                          <Switch disabled checked={false} />
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </TabsContent>

           {/* USERS TAB */}
           <TabsContent value="users">
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white max-w-3xl mx-auto">
                 <CardHeader className="p-8 text-center">
                    <CardTitle className="text-xl font-black text-slate-900">Nhân sự & Phân quyền</CardTitle>
                    <CardDescription>Quản lý tài khoản và phân quyền truy cập hệ thống</CardDescription>
                 </CardHeader>
                 <CardContent className="p-8 pt-0 flex flex-col items-center justify-center space-y-6">
                    <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-2 border-4 border-indigo-100/50">
                       <Users className="w-10 h-10" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 text-center max-w-md">
                       Tính năng tạo tài khoản và phân quyền (Admin, Sale, Telesale) đã được chuyển sang một không gian chuyên biệt để quản lý trực quan hơn.
                    </p>
                    <Button asChild size="lg" className="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-indigo-600 font-black shadow-lg shadow-slate-200 transition-all hover:-translate-y-1 mt-4">
                       <Link to="/admin/users"><Users className="w-5 h-5 mr-3" /> Mở Quản lý Nhân sự</Link>
                    </Button>
                 </CardContent>
              </Card>
           </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function TabTrigger({ value, icon: Icon, label }: any) {
  return (
    <TabsTrigger 
      value={value} 
      className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg shadow-indigo-200 rounded-xl px-6 h-12 text-xs font-black transition-all flex items-center gap-2 text-slate-500"
    >
       <Icon className="w-4 h-4" />
       {label}
    </TabsTrigger>
  );
}
