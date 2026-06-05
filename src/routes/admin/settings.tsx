import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
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
  PackageCheck,
  Sparkles,
  MapPin,
  Compass,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const DEFAULT_CROSS_SELL_RULES = [
  {
    id: "cleansing",
    name: "Dòng Làm sạch & Thải độc (Cleansing)",
    desc: "Sữa rửa mặt, mặt nạ oxy bong bóng sủi bọt, tẩy tế bào chết enzyme",
    note_purchased: "Đã mua đơn hàng trước",
    note_not_purchased: "Chưa từng mua",
    action_label: "CHÀO MẪU TEST",
  },
  {
    id: "serum",
    name: "Dòng Serum & Ampoule Trị liệu (EGF / Vitamin C)",
    desc: "Tế bào gốc phục hồi, Vitamin C trị nám, serum mụn chuyên sâu",
    note_purchased: "Đã mua serum trị liệu trước đó",
    note_not_purchased: "Spa CHƯA MUA - Tỷ lệ lỗ hổng Upsell cực cao 🎯",
    action_label: "CHÀO MẪU TEST",
  },
  {
    id: "cream",
    name: "Dòng Kem dưỡng & Khóa ẩm Cabin (Creams)",
    desc: "Kem cấp ẩm sâu Hyaluronic, kem phục hồi Hydro lipid bơ hạt mỡ",
    note_purchased: "Đã mua đơn hàng trước",
    note_not_purchased: "Chưa từng mua",
    action_label: "CHÀO MẪU TEST",
  },
  {
    id: "sunblock",
    name: "Dòng Chống nắng & Bảo vệ (Sun Shield)",
    desc: "Kem chống nắng vật lý SPF 50+, gel làm dịu mát lô hội sau nắng",
    note_purchased: "Đã mua kem chống nắng trước đó",
    note_not_purchased: "Spa CHƯA MUA - Khách hàng đang bỏ ngỏ dòng bảo vệ da 🎯",
    action_label: "CHÀO MẪU TEST",
  },
];

const DEFAULT_SPA_EQUIPMENT_SCRIPTS = {
  laser: {
    label: "Máy Laser YAG/CO2",
    tag: "TƯ VẤN SAU LASER",
    desc: "Spa có máy Laser ➡️ Khách hàng điều trị nám, sẹo, tàn nhang rất nhiều. Da sau Laser cực kỳ mỏng yếu và tổn thương.",
    script:
      "Tư vấn ngay **Set Tế bào gốc phục hồi EGF Desembre** (hộp 10 ống) kèm Kem chống nắng vật lý bảo vệ chuyên sâu. Nhấn mạnh hiệu quả tái tạo da tức thì, tránh tăng sắc tố sau Laser.",
  },
  needle: {
    label: "Thiết bị Phi kim/Lăn kim",
    tag: "TƯ VẤN SAU PHI KIM",
    desc: "Spa làm dịch vụ Phi kim / Lăn kim ➡️ Liệu trình collagen cảm ứng rất cần chất dẫn phục hồi biểu bì sâu.",
    script:
      "Giới thiệu dòng **Mặt nạ thải độc sủi bọt Desembre Oxy Bubble Mask** hoặc Serum đặc trị sẹo rỗ, lỗ chân lông to của Desembre để làm sạch sâu cabin trước và nuôi da sau liệu trình phi kim.",
  },
  hifu: {
    label: "Máy HIFU / Nâng cơ",
    tag: "TƯ VẤN SAU HIFU / NÂNG CƠ",
    desc: "Spa làm trẻ hóa nâng cơ bằng HIFU/RF ➡️ Cần bổ sung dưỡng chất nâng cơ, chống nhăn chùng chảy xệ tại nhà để duy trì kết quả máy.",
    script:
      "Chào dòng **Kem dưỡng trẻ hóa peptide 24K Gold Desembre Luxury Gold** cao cấp. Tỷ lệ chốt cực cao vì tệp khách làm HIFU là tệp khách VIP, sẵn sàng chi trả mức giá trị lớn!",
  },
  rf: {
    label: "Máy RF / Giảm béo",
    tag: "TƯ VẤN GIẢM BÉO & SĂN CHẮC",
    desc: "Spa có máy RF hoặc máy giảm béo cơ thể/mặt ➡️ Liệu trình tiêu mỡ cần kem massage và gel dẫn hỗ trợ hóa lỏng mỡ thừa.",
    script:
      "Giới thiệu dòng **Kem massage giảm béo nóng Desembre** kết hợp với RF để tăng hiệu quả đốt mỡ x3 lần và Serum nâng cơ peptide.",
  },
};

function parseGoogleMapsUrlToCoordinates(
  input: string,
): { latitude: number; longitude: number } | null {
  const trimmed = input.trim();

  // 1. Tọa độ trực tiếp dạng "21.028511, 105.804817" hoặc "21.028511,105.804817"
  const directMatch = trimmed.match(/^([-+]?[0-9]*\.?[0-9]+)\s*,\s*([-+]?[0-9]*\.?[0-9]+)$/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 2. URL chứa cấu trúc @latitude,longitude
  const urlAtMatch = trimmed.match(/@([-+]?[0-9]*\.?[0-9]+),([-+]?[0-9]*\.?[0-9]+)/);
  if (urlAtMatch) {
    const lat = parseFloat(urlAtMatch[1]);
    const lng = parseFloat(urlAtMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 3. URL chứa /place/latitude,longitude
  const placeMatch = trimmed.match(/\/place\/([-+]?[0-9]*\.?[0-9]+),([-+]?[0-9]*\.?[0-9]+)/);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 4. URL chứa query parameter q=latitude,longitude
  const qMatch = trimmed.match(/[?&]q=([-+]?[0-9]*\.?[0-9]+),([-+]?[0-9]*\.?[0-9]+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

export const Route = createFileRoute("/admin/settings")({
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  const { user, isAdmin, isSubAdmin, isManager, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [cycleSearch, setCycleSearch] = useState("");
  // productCycles: { [productId]: { retail?: number; salon?: number } }
  const [productCycles, setProductCycles] = useState<
    Record<number, { retail?: number; salon?: number }>
  >({});

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
    refillCycleDays: 60,
    crossSellRules: DEFAULT_CROSS_SELL_RULES,
    spaEquipmentScripts: DEFAULT_SPA_EQUIPMENT_SCRIPTS,
    routingNearKm: 10,
    routingCityKm: 30,
    routingFarKm: 80,
  });
  const [loadingConfig, setLoadingConfig] = useState(true);

  // States cho cấu hình Văn phòng / Mốc định vị
  const [officeConfig, setOfficeConfig] = useState<any>(null);
  const [loadingOffice, setLoadingOffice] = useState(true);
  const [savingOffice, setSavingOffice] = useState(false);
  const [mapsUrlInput, setMapsUrlInput] = useState("");

  const loadOffice = async () => {
    try {
      setLoadingOffice(true);
      const { data, error } = await supabase
        .from("company_locations" as any)
        .select("*")
        .eq("is_default", true)
        .eq("is_active", true)
        .limit(1);

      if (error) {
        console.error("Error loading office:", error);
      } else if (data && data.length > 0) {
        setOfficeConfig(data[0]);
      } else {
        setOfficeConfig(null);
      }
    } catch (err) {
      console.error("Failed to load office:", err);
    } finally {
      setLoadingOffice(false);
    }
  };

  useEffect(() => {
    loadOffice();
  }, []);

  const handleInitializeOffice = async () => {
    try {
      setSavingOffice(true);
      const payload = {
        name: "Văn phòng Hà Nội",
        code: "hanoi_office",
        address: "Chưa cập nhật, Hà Nội",
        city: "Hà Nội",
        district: "Ba Đình",
        location_type: "office",
        is_default: true,
        is_active: true,
        latitude: 21.028511,
        longitude: 105.804817,
      };

      const { data, error } = await supabase
        .from("company_locations" as any)
        .insert([payload])
        .select();

      if (error) {
        toast.error("Lỗi khởi tạo văn phòng: " + error.message);
      } else {
        toast.success("Đã khởi tạo văn phòng Hà Nội mặc định!");
        if (data && data.length > 0) {
          setOfficeConfig(data[0]);
        } else {
          await loadOffice();
        }
      }
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setSavingOffice(false);
    }
  };

  const handleOfficeFieldChange = (field: string, value: any) => {
    setOfficeConfig((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleParseGoogleMaps = () => {
    if (!mapsUrlInput.trim()) {
      toast.error("Vui lòng nhập URL hoặc tọa độ từ Google Maps!");
      return;
    }

    const coords = parseGoogleMapsUrlToCoordinates(mapsUrlInput);
    if (coords) {
      handleOfficeFieldChange("latitude", coords.latitude);
      handleOfficeFieldChange("longitude", coords.longitude);
      toast.success(`Đã nhận diện tọa độ: ${coords.latitude}, ${coords.longitude}`);
      setMapsUrlInput(""); // clear input
    } else {
      toast.error("Không đọc được tọa độ từ nội dung đã dán.");
    }
  };

  const handleOpenGoogleMaps = () => {
    if (!officeConfig) return;
    const lat = parseFloat(officeConfig.latitude);
    const lng = parseFloat(officeConfig.longitude);
    if (!isNaN(lat) && lat >= -90 && lat <= 90 && !isNaN(lng) && lng >= -180 && lng <= 180) {
      window.open(`https://www.google.com/maps/place/${lat},${lng}`, "_blank");
    } else {
      toast.error("Tọa độ hiện tại không hợp lệ để mở Google Maps!");
    }
  };

  const handleSaveOffice = async () => {
    if (!officeConfig) return;

    if (!officeConfig.name?.trim()) {
      toast.error("Tên mốc định vị không được để trống!");
      return;
    }
    if (!officeConfig.code?.trim()) {
      toast.error("Mã mốc không được để trống!");
      return;
    }

    const lat = parseFloat(officeConfig.latitude);
    const lng = parseFloat(officeConfig.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast.error("Vĩ độ (Latitude) phải là số từ -90 đến 90!");
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      toast.error("Kinh độ (Longitude) phải là số từ -180 đến 180!");
      return;
    }

    try {
      setSavingOffice(true);
      const payload = {
        name: officeConfig.name.trim(),
        code: officeConfig.code.trim(),
        address: officeConfig.address || "",
        city: officeConfig.city || "",
        district: officeConfig.district || "",
        location_type: officeConfig.location_type || "office",
        latitude: lat,
        longitude: lng,
        is_default: officeConfig.is_default ?? true,
        is_active: officeConfig.is_active ?? true,
      };

      let error;
      if (officeConfig.id) {
        const { error: err } = await supabase
          .from("company_locations" as any)
          .update(payload)
          .eq("id", officeConfig.id);
        error = err;
      } else {
        const { error: err } = await supabase.from("company_locations" as any).insert([payload]);
        error = err;
      }

      if (error) {
        toast.error("Lỗi lưu cấu hình văn phòng: " + error.message);
      } else {
        toast.success("Đã cập nhật mốc định vị công ty.");
        await loadOffice();
      }
    } catch (err: any) {
      toast.error("Không thể lưu: " + err.message);
    } finally {
      setSavingOffice(false);
    }
  };

  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from("system_settings").select("*").maybeSingle();

      const savedTier = localStorage.getItem("system_tier_settings");
      const tierSettings = savedTier
        ? JSON.parse(savedTier)
        : {
            goldThreshold: 50000000,
            goldDiscount: 62,
            diamondThreshold: 100000000,
            diamondDiscount: 65,
            refillCycleDays: 60,
          };

      const savedCrossSell = localStorage.getItem("system_cross_sell_rules");
      const savedSpaScripts = localStorage.getItem("system_spa_equipment_scripts");

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
          goldThreshold: data.gold_threshold ?? tierSettings.goldThreshold,
          goldDiscount: data.gold_discount ?? tierSettings.goldDiscount,
          diamondThreshold: data.diamond_threshold ?? tierSettings.diamondThreshold,
          diamondDiscount: data.diamond_discount ?? tierSettings.diamondDiscount,
          refillCycleDays: data.refill_cycle_days ?? tierSettings.refillCycleDays,
          crossSellRules:
            data.cross_sell_rules &&
            Array.isArray(data.cross_sell_rules) &&
            data.cross_sell_rules.length > 0
              ? data.cross_sell_rules
              : savedCrossSell
                ? JSON.parse(savedCrossSell)
                : DEFAULT_CROSS_SELL_RULES,
          spaEquipmentScripts:
            data.spa_equipment_scripts &&
            typeof data.spa_equipment_scripts === "object" &&
            Object.keys(data.spa_equipment_scripts).length > 0
              ? data.spa_equipment_scripts
              : savedSpaScripts
                ? JSON.parse(savedSpaScripts)
                : DEFAULT_SPA_EQUIPMENT_SCRIPTS,
          routingNearKm: data.routing_near_km ?? 10,
          routingCityKm: data.routing_city_km ?? 30,
          routingFarKm: data.routing_far_km ?? 80,
        });

        if (data.product_cycles && typeof data.product_cycles === "object") {
          setProductCycles(data.product_cycles as any);
        } else {
          const savedCycles = localStorage.getItem("product_cycle_settings");
          if (savedCycles) {
            try {
              setProductCycles(JSON.parse(savedCycles));
            } catch {}
          }
        }
      } else {
        setConfig((prev: any) => ({
          ...prev,
          ...tierSettings,
          crossSellRules: savedCrossSell ? JSON.parse(savedCrossSell) : DEFAULT_CROSS_SELL_RULES,
          spaEquipmentScripts: savedSpaScripts
            ? JSON.parse(savedSpaScripts)
            : DEFAULT_SPA_EQUIPMENT_SCRIPTS,
        }));
        const savedCycles = localStorage.getItem("product_cycle_settings");
        if (savedCycles) {
          try {
            setProductCycles(JSON.parse(savedCycles));
          } catch {}
        }
      }
      setLoadingConfig(false);
    }
    loadConfig();
  }, []);

  const handleLogoUpload = async (file: File, type: "light" | "dark") => {
    if (!file) return;
    try {
      toast.loading("Đang tải ảnh lên...", { id: "upload-logo" });
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${type}-${Math.random()}.${fileExt}`;
      const filePath = `brand/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(filePath);

      setConfig((prev: any) => ({
        ...prev,
        [type === "light" ? "logoLightUrl" : "logoDarkUrl"]: publicUrl,
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
      refillCycleDays: Number(config.refillCycleDays),
    };
    localStorage.setItem("system_tier_settings", JSON.stringify(tierSettings));
    // Save per-product cycle settings
    localStorage.setItem("product_cycle_settings", JSON.stringify(productCycles));

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
      lead_overdue_days: Number(config.leadOverdueDays),
      gold_threshold: Number(config.goldThreshold),
      gold_discount: Number(config.goldDiscount),
      diamond_threshold: Number(config.diamondThreshold),
      diamond_discount: Number(config.diamondDiscount),
      refill_cycle_days: Number(config.refillCycleDays),
      product_cycles: productCycles,
      cross_sell_rules: config.crossSellRules,
      spa_equipment_scripts: config.spaEquipmentScripts,
      routing_near_km: Number(config.routingNearKm),
      routing_city_km: Number(config.routingCityKm),
      routing_far_km: Number(config.routingFarKm),
    };

    let error;
    let isFallback = false;

    if (config.id) {
      const res = await supabase.from("system_settings").update(payload).eq("id", config.id);
      error = res.error;

      if (error && (error.message.includes("column") || error.message.includes("schema cache"))) {
        const fallbackPayload = { ...payload };
        delete (fallbackPayload as any).cross_sell_rules;
        delete (fallbackPayload as any).spa_equipment_scripts;
        const resFallback = await supabase
          .from("system_settings")
          .update(fallbackPayload)
          .eq("id", config.id);
        if (!resFallback.error) {
          localStorage.setItem("system_cross_sell_rules", JSON.stringify(config.crossSellRules));
          localStorage.setItem(
            "system_spa_equipment_scripts",
            JSON.stringify(config.spaEquipmentScripts),
          );
          error = null;
          isFallback = true;
        }
      }
    } else {
      const res = await supabase.from("system_settings").insert([payload]);
      error = res.error;

      if (error && (error.message.includes("column") || error.message.includes("schema cache"))) {
        const fallbackPayload = { ...payload };
        delete (fallbackPayload as any).cross_sell_rules;
        delete (fallbackPayload as any).spa_equipment_scripts;
        const resFallback = await supabase.from("system_settings").insert([fallbackPayload]);
        if (!resFallback.error) {
          localStorage.setItem("system_cross_sell_rules", JSON.stringify(config.crossSellRules));
          localStorage.setItem(
            "system_spa_equipment_scripts",
            JSON.stringify(config.spaEquipmentScripts),
          );
          error = null;
          isFallback = true;
        }
      }
    }

    setBusy(false);
    if (error) {
      toast.error("Lỗi cập nhật cấu hình: " + error.message);
    } else {
      if (isFallback) {
        toast.success(
          "Đã cập nhật cấu hình hệ thống! Các quy tắc bán hàng & kịch bản AI đã được lưu tạm cục bộ do database chưa nâng cấp.",
        );
        reloadSettings();
      } else {
        toast.success("Đã cập nhật cấu hình hệ thống thành công!");
        reloadSettings();
      }
    }
  };

  const handleCycleChange = (productId: number, variantType: "retail" | "salon", days: number) => {
    setProductCycles((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [variantType]: days },
    }));
  };

  const handleResetCycle = (productId: number, variantType?: "retail" | "salon") => {
    setProductCycles((prev) => {
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

  if (authLoading || loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
            Đang tải cấu hình...
          </p>
        </div>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">
          Trang cấu hình hệ thống chỉ dành riêng cho Admin hoặc Phó Admin.
        </p>
        <Link
          to="/workspace"
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
        >
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      {/* HEADER */}
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <Link
              to="/workspace"
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Cấu hình Hệ thống
              </h1>
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
                    <CardTitle className="text-lg font-black text-slate-900">
                      Nhận diện Thương hiệu
                    </CardTitle>
                    <CardDescription>
                      Tùy chỉnh Logo và màu sắc đại diện cho DESEMBRE
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-4 space-y-8">
                    <div className="flex flex-col md:flex-row gap-12 items-center">
                      <div className="space-y-4 text-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Logo Chính (Light)
                        </label>
                        <label className="w-32 h-32 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-4 group hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden block mx-auto">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleLogoUpload(e.target.files[0], "light");
                            }}
                          />
                          {config.logoLightUrl ? (
                            <img
                              src={config.logoLightUrl}
                              alt="Logo Light"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <>
                              <ImageIcon className="w-8 h-8 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                              <p className="text-[9px] font-bold text-slate-400 mt-2">
                                1024x1024 px
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                      <div className="space-y-4 text-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Logo Phụ (Dark)
                        </label>
                        <label className="w-32 h-32 rounded-3xl bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-4 group hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden block mx-auto">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleLogoUpload(e.target.files[0], "dark");
                            }}
                          />
                          {config.logoDarkUrl ? (
                            <img
                              src={config.logoDarkUrl}
                              alt="Logo Dark"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <>
                              <ImageIcon className="w-8 h-8 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                              <p className="text-[9px] font-bold text-slate-500 mt-2">
                                White Version
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                      <div className="flex-1 space-y-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Màu chủ đạo (Primary Color)
                          </Label>
                          <div className="flex items-center gap-4">
                            <div
                              className="w-12 h-12 rounded-xl shadow-lg shadow-indigo-100"
                              style={{ backgroundColor: config.primaryColor }}
                            ></div>
                            <Input
                              value={config.primaryColor}
                              onChange={(e) =>
                                setConfig({ ...config, primaryColor: e.target.value })
                              }
                              className="h-10 rounded-xl font-mono text-sm uppercase"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Màu nhấn (Accent Color)
                          </Label>
                          <div className="flex items-center gap-4">
                            <div
                              className="w-12 h-12 rounded-xl shadow-lg shadow-pink-100"
                              style={{ backgroundColor: config.accentColor }}
                            ></div>
                            <Input
                              value={config.accentColor}
                              onChange={(e) =>
                                setConfig({ ...config, accentColor: e.target.value })
                              }
                              className="h-10 rounded-xl font-mono text-sm uppercase"
                            />
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
                    <CardTitle className="text-base font-black text-slate-900">
                      Xem trước (UI Preview)
                    </CardTitle>
                    <CardDescription>Giao diện sẽ thay đổi theo cấu hình màu sắc</CardDescription>
                  </CardHeader>
                  <CardContent className="px-8 pb-8 flex flex-col items-center justify-center space-y-6">
                    <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg"
                          style={{ backgroundColor: config.primaryColor }}
                        ></div>
                        <div className="space-y-1 flex-1">
                          <div className="h-2 w-20 bg-slate-200 rounded"></div>
                          <div className="h-1.5 w-32 bg-slate-100 rounded"></div>
                        </div>
                      </div>
                      <div
                        className="h-8 w-full rounded-xl"
                        style={{ backgroundColor: config.primaryColor }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center italic">
                      Đây là ví dụ về cách màu sắc hiển thị trên Dashboard của nhân viên.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* COMPANY TAB */}
          <TabsContent value="company">
            <div className="space-y-8 max-w-3xl mx-auto">
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-8">
                  <CardTitle className="text-lg font-black text-slate-900">
                    Thông tin Pháp lý
                  </CardTitle>
                  <CardDescription>
                    Thông tin này sẽ xuất hiện trên Hợp đồng và Hóa đơn
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Tên công ty đầy đủ
                      </Label>
                      <Input
                        value={config.companyName}
                        onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                        className="h-12 rounded-xl font-bold"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Địa chỉ trụ sở chính
                      </Label>
                      <Input
                        value={config.address}
                        onChange={(e) => setConfig({ ...config, address: e.target.value })}
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Email hỗ trợ
                      </Label>
                      <Input
                        value={config.supportEmail}
                        onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Hotline tổng đài
                      </Label>
                      <Input
                        value={config.supportPhone}
                        onChange={(e) => setConfig({ ...config, supportPhone: e.target.value })}
                        className="h-12 rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-black text-slate-900">
                        Văn phòng / Mốc định vị
                      </CardTitle>
                      <CardDescription>
                        Mốc này dùng để tính khoảng cách khách hàng, phân tuyến Sale/Tele và lập
                        tuyến đi.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-8 pt-0 space-y-6">
                  {loadingOffice ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                        Đang tải cấu hình văn phòng...
                      </p>
                    </div>
                  ) : !officeConfig ? (
                    <div className="py-12 text-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <Compass className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">
                          Chưa cấu hình văn phòng mặc định.
                        </p>
                        <p className="text-xs text-slate-400">
                          Mốc định vị văn phòng Hà Nội mặc định chưa được khởi tạo trên hệ thống.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleInitializeOffice}
                        disabled={savingOffice}
                        className="rounded-xl bg-slate-900 hover:bg-black font-black text-xs h-11 px-6 mt-2"
                      >
                        {savingOffice ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Đang khởi tạo...
                          </>
                        ) : (
                          "Khởi tạo văn phòng Hà Nội"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                        <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                          Dán URL hoặc tọa độ Google Maps
                        </Label>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Hỗ trợ tọa độ thô <code>21.028511, 105.804817</code> hoặc liên kết chia sẻ
                          từ Google Maps.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Input
                            value={mapsUrlInput}
                            onChange={(e) => setMapsUrlInput(e.target.value)}
                            placeholder="Ví dụ: https://maps.google.com/?q=21.028511,105.804817 hoặc 21.028511, 105.804817"
                            className="h-11 rounded-xl bg-white border-slate-200 text-sm flex-1"
                          />
                          <Button
                            type="button"
                            onClick={handleParseGoogleMaps}
                            className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-xs shrink-0"
                          >
                            Dán tọa độ từ Google Maps
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Tên mốc định vị
                          </Label>
                          <Input
                            value={officeConfig.name || ""}
                            onChange={(e) => handleOfficeFieldChange("name", e.target.value)}
                            className="h-12 rounded-xl font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Mã mốc (Unique Code)
                          </Label>
                          <Input
                            value={officeConfig.code || ""}
                            onChange={(e) => handleOfficeFieldChange("code", e.target.value)}
                            className="h-12 rounded-xl font-bold font-mono"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Địa chỉ chi tiết
                          </Label>
                          <Input
                            value={officeConfig.address || ""}
                            onChange={(e) => handleOfficeFieldChange("address", e.target.value)}
                            className="h-12 rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Thành phố
                          </Label>
                          <Input
                            value={officeConfig.city || ""}
                            onChange={(e) => handleOfficeFieldChange("city", e.target.value)}
                            className="h-12 rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Quận / Huyện
                          </Label>
                          <Input
                            value={officeConfig.district || ""}
                            onChange={(e) => handleOfficeFieldChange("district", e.target.value)}
                            className="h-12 rounded-xl"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Vĩ độ (Latitude)
                          </Label>
                          <Input
                            value={officeConfig.latitude ?? ""}
                            onChange={(e) => handleOfficeFieldChange("latitude", e.target.value)}
                            className="h-12 rounded-xl font-mono"
                            type="number"
                            step="any"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Kinh độ (Longitude)
                          </Label>
                          <Input
                            value={officeConfig.longitude ?? ""}
                            onChange={(e) => handleOfficeFieldChange("longitude", e.target.value)}
                            className="h-12 rounded-xl font-mono"
                            type="number"
                            step="any"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Loại địa điểm
                          </Label>
                          <select
                            value={officeConfig.location_type || "office"}
                            onChange={(e) =>
                              handleOfficeFieldChange("location_type", e.target.value)
                            }
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white font-bold text-sm outline-none focus:border-indigo-500"
                          >
                            <option value="office">Văn phòng (Office)</option>
                            <option value="warehouse">Kho hàng (Warehouse)</option>
                            <option value="store">Cửa hàng (Store)</option>
                            <option value="landmark">Mốc định vị (Landmark)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-4 justify-center md:pl-2">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-900">Là mốc mặc định</p>
                              <p className="text-[10px] text-slate-400">
                                Dùng làm tọa độ xuất phát chính
                              </p>
                            </div>
                            <Switch
                              checked={officeConfig.is_default ?? false}
                              onCheckedChange={(checked) =>
                                handleOfficeFieldChange("is_default", checked)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-900">
                                Trạng thái hoạt động
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Cho phép hệ thống sử dụng mốc này
                              </p>
                            </div>
                            <Switch
                              checked={officeConfig.is_active ?? false}
                              onCheckedChange={(checked) =>
                                handleOfficeFieldChange("is_active", checked)
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                        <Button
                          type="button"
                          onClick={handleOpenGoogleMaps}
                          variant="outline"
                          className="h-12 rounded-xl font-bold text-xs flex-1 hover:bg-slate-50 border-slate-200"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" /> Mở Google Maps
                        </Button>
                        <Button
                          type="button"
                          onClick={handleSaveOffice}
                          disabled={savingOffice}
                          className="h-12 rounded-xl bg-slate-900 hover:bg-black font-black text-xs flex-1"
                        >
                          {savingOffice ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Đang lưu cấu
                              hình...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" /> Lưu cấu hình
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-black text-slate-900">
                        Mốc khoảng cách Phân tuyến
                      </CardTitle>
                      <CardDescription>
                        Cấu hình khoảng cách (km) để hệ thống tự động gợi ý mô hình phù hợp.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Khu vực Gần (Sale Trực tiếp)
                      </Label>
                      <div className="relative">
                        <Input
                          value={config.routingNearKm || ""}
                          onChange={(e) =>
                            setConfig({ ...config, routingNearKm: Number(e.target.value) })
                          }
                          className="h-12 rounded-xl font-bold pr-10"
                          type="number"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          km
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Dưới mốc này: Direct Sale</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Nội thành (Cùng thành phố)
                      </Label>
                      <div className="relative">
                        <Input
                          value={config.routingCityKm || ""}
                          onChange={(e) =>
                            setConfig({ ...config, routingCityKm: Number(e.target.value) })
                          }
                          className="h-12 rounded-xl font-bold pr-10"
                          type="number"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          km
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Từ Gần đến mốc này: Direct Sale
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Ngoại thành (Hybrid)
                      </Label>
                      <div className="relative">
                        <Input
                          value={config.routingFarKm || ""}
                          onChange={(e) =>
                            setConfig({ ...config, routingFarKm: Number(e.target.value) })
                          }
                          className="h-12 rounded-xl font-bold pr-10"
                          type="number"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          km
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Lớn hơn mốc này: Tỉnh xa (Tele Owned)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* RULES TAB */}
          <TabsContent value="rules">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-8">
                  <CardTitle className="text-lg font-black text-slate-900">
                    Tài chính & Thuế
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">Tỷ lệ VAT mặc định</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Áp dụng cho mọi đơn hàng mới
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={config.vatRate}
                          onChange={(e) => setConfig({ ...config, vatRate: e.target.value })}
                          className="w-20 h-10 rounded-xl text-center font-bold"
                          type="number"
                        />
                        <span className="font-black text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">Chiết khấu Đại lý cơ sở</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Áp dụng khi chưa có hạng mức riêng
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={config.defaultDiscount}
                          onChange={(e) =>
                            setConfig({ ...config, defaultDiscount: e.target.value })
                          }
                          className="w-20 h-10 rounded-xl text-center font-bold"
                          type="number"
                        />
                        <span className="font-black text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-8">
                  <CardTitle className="text-lg font-black text-slate-900">
                    Tự động hóa (Automations)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">
                          Gửi Mail khi có Đơn hàng
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Thông báo tự động cho khách
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">
                          Thời gian cảnh báo quá hạn
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Thời gian (ngày) Lead báo giá bị bỏ quên
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={config.leadOverdueDays}
                          onChange={(e) =>
                            setConfig({ ...config, leadOverdueDays: e.target.value })
                          }
                          className="w-20 h-10 rounded-xl text-center font-bold"
                          type="number"
                        />
                        <span className="font-black text-slate-400">ngày</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* CARD 3: Cấu hình Phân hạng Đại lý */}
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-8">
                  <CardTitle className="text-lg font-black text-slate-900">
                    Cấu hình Hạng thành viên Spa
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">
                          Doanh số tối thiểu đạt GOLD
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Ngưỡng LTV tích lũy để thăng hạng Gold
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={config.goldThreshold || ""}
                          onChange={(e) => setConfig({ ...config, goldThreshold: e.target.value })}
                          className="w-32 h-10 rounded-xl text-right font-bold"
                          type="number"
                        />
                        <span className="font-black text-slate-400">đ</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">
                          Chiết khấu đặc quyền GOLD
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Chiết khấu gối đầu cho đại lý Gold
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={config.goldDiscount || ""}
                          onChange={(e) => setConfig({ ...config, goldDiscount: e.target.value })}
                          className="w-20 h-10 rounded-xl text-center font-bold"
                          type="number"
                        />
                        <span className="font-black text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 my-4"></div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">
                          Doanh số tối thiểu đạt DIAMOND
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Ngưỡng LTV tích lũy để thăng hạng Diamond
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={config.diamondThreshold || ""}
                          onChange={(e) =>
                            setConfig({ ...config, diamondThreshold: e.target.value })
                          }
                          className="w-32 h-10 rounded-xl text-right font-bold"
                          type="number"
                        />
                        <span className="font-black text-slate-400">đ</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">
                          Chiết khấu đặc quyền DIAMOND
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Chiết khấu gối đầu cho đại lý Diamond
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={config.diamondDiscount || ""}
                          onChange={(e) =>
                            setConfig({ ...config, diamondDiscount: e.target.value })
                          }
                          className="w-20 h-10 rounded-xl text-center font-bold"
                          type="number"
                        />
                        <span className="font-black text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CARD 4: Cảnh báo chu kỳ cạn kiệt */}
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-8">
                  <CardTitle className="text-lg font-black text-slate-900">
                    Cảnh báo Refill & Cạn kiệt
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">
                          Chu kỳ sử dụng hết mỹ phẩm
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Số ngày ước lượng chu kỳ tiêu thụ của Spa
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={config.refillCycleDays || ""}
                          onChange={(e) =>
                            setConfig({ ...config, refillCycleDays: e.target.value })
                          }
                          className="w-24 h-10 rounded-xl text-center font-bold"
                          type="number"
                        />
                        <span className="font-black text-slate-400">ngày</span>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-[11px] font-medium text-amber-800 leading-relaxed">
                      💡 <strong>Mẹo vận hành:</strong> CRM sẽ tự động đếm ngược từ ngày chốt đơn
                      thành công gần nhất. Khi thời gian sử dụng còn dưới 10 ngày (Ví dụ: đã trôi
                      qua {Number(config.refillCycleDays || 60) - 10} ngày), hệ thống sẽ hiển thị
                      thẻ cảnh báo tái đặt hàng trên Workspace để nhân viên Sale gọi điện Upsell gối
                      đầu!
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CARD 5: Cấu hình quy tắc Gợi ý Bán chéo */}
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white md:col-span-2">
                <CardHeader className="p-8">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    <div>
                      <CardTitle className="text-lg font-black text-slate-900">
                        Quy tắc Gợi ý Bán chéo & Lỗ hổng Mua sắm
                      </CardTitle>
                      <CardDescription>
                        Cấu hình các nhóm sản phẩm lõi cabin Spa để nhân viên Sale nhận diện lỗ hổng
                        và tư vấn Upsell
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="grid grid-cols-1 gap-6 divide-y divide-slate-100">
                    {(config.crossSellRules || []).map((rule: any, idx: number) => (
                      <div
                        key={rule.id}
                        className={`pt-6 ${idx === 0 ? "pt-0 border-none" : ""} space-y-4`}
                      >
                        <div className="flex items-center justify-between">
                          <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-xl">
                            Nhóm {idx + 1}: {rule.id.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Tên nhóm sản phẩm
                            </Label>
                            <Input
                              value={rule.name}
                              onChange={(e) => {
                                const newRules = [...config.crossSellRules];
                                newRules[idx].name = e.target.value;
                                setConfig({ ...config, crossSellRules: newRules });
                              }}
                              className="h-10 rounded-xl font-bold"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Nhãn nút hành động (Call To Action)
                            </Label>
                            <Input
                              value={rule.action_label}
                              onChange={(e) => {
                                const newRules = [...config.crossSellRules];
                                newRules[idx].action_label = e.target.value;
                                setConfig({ ...config, crossSellRules: newRules });
                              }}
                              className="h-10 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Mô tả nhóm sản phẩm
                            </Label>
                            <Input
                              value={rule.desc}
                              onChange={(e) => {
                                const newRules = [...config.crossSellRules];
                                newRules[idx].desc = e.target.value;
                                setConfig({ ...config, crossSellRules: newRules });
                              }}
                              className="h-10 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Ghi chú khi ĐÃ MUA
                            </Label>
                            <Input
                              value={rule.note_purchased}
                              onChange={(e) => {
                                const newRules = [...config.crossSellRules];
                                newRules[idx].note_purchased = e.target.value;
                                setConfig({ ...config, crossSellRules: newRules });
                              }}
                              className="h-10 rounded-xl text-emerald-600 bg-emerald-50/20 border-emerald-100"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Ghi chú khi CHƯA MUA (Cảnh báo lỗ hổng)
                            </Label>
                            <Input
                              value={rule.note_not_purchased}
                              onChange={(e) => {
                                const newRules = [...config.crossSellRules];
                                newRules[idx].note_not_purchased = e.target.value;
                                setConfig({ ...config, crossSellRules: newRules });
                              }}
                              className="h-10 rounded-xl text-rose-600 bg-rose-50/20 border-rose-100 font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* CARD 6: Cấu hình Kịch bản AI theo Thiết bị Spa */}
              <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white md:col-span-2">
                <CardHeader className="p-8">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <div>
                      <CardTitle className="text-lg font-black text-slate-900">
                        Kịch bản tư vấn thông minh AI theo Thiết bị Spa
                      </CardTitle>
                      <CardDescription>
                        Tùy chỉnh tiêu đề thiết bị, tình trạng bệnh lý da liễu liên quan và kịch bản
                        gợi ý chốt đơn cho nhân viên Sale
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-8">
                  <div className="grid grid-cols-1 gap-6 divide-y divide-slate-100">
                    {Object.keys(config.spaEquipmentScripts || {}).map(
                      (eqId: string, idx: number) => {
                        const eq = config.spaEquipmentScripts[eqId];
                        return (
                          <div
                            key={eqId}
                            className={`pt-6 ${idx === 0 ? "pt-0 border-none" : ""} space-y-4`}
                          >
                            <div className="flex items-center justify-between">
                              <Badge className="bg-amber-50 text-amber-600 border-amber-100 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-xl">
                                Thiết bị: {eqId.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Tên thiết bị hiển thị
                                </Label>
                                <Input
                                  value={eq.label}
                                  onChange={(e) => {
                                    const newScripts = { ...config.spaEquipmentScripts };
                                    newScripts[eqId].label = e.target.value;
                                    setConfig({ ...config, spaEquipmentScripts: newScripts });
                                  }}
                                  className="h-10 rounded-xl font-bold"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Nhãn Tab gợi ý (Tag)
                                </Label>
                                <Input
                                  value={eq.tag}
                                  onChange={(e) => {
                                    const newScripts = { ...config.spaEquipmentScripts };
                                    newScripts[eqId].tag = e.target.value;
                                    setConfig({ ...config, spaEquipmentScripts: newScripts });
                                  }}
                                  className="h-10 rounded-xl text-indigo-600 bg-indigo-50/10 border-indigo-100 font-bold"
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Mô tả đặc trưng / Phân tích nhu cầu điều trị
                                </Label>
                                <textarea
                                  value={eq.desc}
                                  onChange={(e) => {
                                    const newScripts = { ...config.spaEquipmentScripts };
                                    newScripts[eqId].desc = e.target.value;
                                    setConfig({ ...config, spaEquipmentScripts: newScripts });
                                  }}
                                  rows={2}
                                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Kịch bản chốt đơn AI gợi ý cho nhân viên Sale
                                </Label>
                                <textarea
                                  value={eq.script}
                                  onChange={(e) => {
                                    const newScripts = { ...config.spaEquipmentScripts };
                                    newScripts[eqId].script = e.target.value;
                                    setConfig({ ...config, spaEquipmentScripts: newScripts });
                                  }}
                                  rows={3}
                                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
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
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">
                          Bảng Chu kỳ Refill theo Sản phẩm
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">
                          Cấu hình số ngày tiêu thụ hết sản phẩm riêng lẻ cho từng SKU. Mặc định
                          dùng chu kỳ toàn cục ({config.refillCycleDays} ngày).
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black text-[10px] px-4 py-2 rounded-xl">
                        {Object.values(productCycles).reduce(
                          (acc, v) => acc + Object.keys(v).length,
                          0,
                        )}{" "}
                        variant đã cấu hình
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-red-100 text-red-500 hover:bg-red-50 font-bold text-xs"
                        onClick={() => {
                          setProductCycles({});
                          toast.success("Đã reset toàn bộ chu kỳ sản phẩm về mặc định");
                        }}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset tất cả
                      </Button>
                    </div>
                  </div>
                  <div className="relative mt-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Tìm tên sản phẩm..."
                      className="pl-11 h-12 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white font-medium"
                      value={cycleSearch}
                      onChange={(e) => setCycleSearch(e.target.value)}
                    />
                  </div>
                  <div className="mt-5 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-[11px] font-medium text-indigo-800 leading-relaxed">
                    💡 <strong>Cách hoạt động:</strong> Khi một sản phẩm được chốt đơn thành công,
                    hệ thống bắt đầu đếm ngược theo chu kỳ này. Khi còn &lt; 10 ngày, thẻ Upsell sẽ
                    xuất hiện trên màn hình nhân viên Sale để nhắc gọi điện gối đầu.
                  </div>
                </CardContent>
              </Card>
              {CATEGORIES.map((cat) => {
                const catProducts = PRODUCTS.filter(
                  (p) =>
                    p.categoryId === cat.id &&
                    (cycleSearch === "" ||
                      p.name.toLowerCase().includes(cycleSearch.toLowerCase())),
                );
                if (catProducts.length === 0) return null;
                return (
                  <Card
                    key={cat.id}
                    className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white"
                  >
                    <CardHeader className="px-8 pt-6 pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                        <div>
                          <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">
                            {cat.name}
                          </CardTitle>
                          {cat.nameVi && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              {cat.nameVi}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="ml-auto border-slate-200 text-slate-400 text-[10px] font-black"
                        >
                          {catProducts.length} sản phẩm
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 mt-4">
                      <table className="w-full">
                        <thead>
                          <tr className="border-y border-slate-100 bg-slate-50/60">
                            <th className="px-8 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              SKU &amp; Tên sản phẩm
                            </th>
                            <th className="px-8 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Dung tích
                            </th>
                            <th className="px-8 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Chu kỳ mặc định
                            </th>
                            <th className="px-8 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Chu kỳ riêng (ngày)
                            </th>
                            <th className="px-8 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Trạng thái
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {catProducts.flatMap((p) => {
                            const retail = p.variants.find((v) => v.type === "retail");
                            const salon = p.variants.find((v) => v.type === "salon");
                            const hasBothSizes = !!(retail && salon);
                            const cycleEntry = productCycles[p.id] || {};
                            const isAnyCustomized = Object.keys(cycleEntry).length > 0;

                            type VRow = {
                              v:
                                | { size: string; price: number; type: string; id: string }
                                | undefined;
                              vType: "retail" | "salon";
                              label: string;
                              colorClass: string;
                              bgClass: string;
                              borderClass: string;
                            };
                            const variantRows: VRow[] = [];
                            if (retail)
                              variantRows.push({
                                v: retail,
                                vType: "retail",
                                label: "RETAIL",
                                colorClass: "text-blue-600",
                                bgClass: "bg-blue-50",
                                borderClass: "border-blue-200",
                              });
                            if (salon)
                              variantRows.push({
                                v: salon,
                                vType: "salon",
                                label: "SALON",
                                colorClass: "text-purple-600",
                                bgClass: "bg-purple-50",
                                borderClass: "border-purple-200",
                              });

                            return variantRows.map((row, rowIdx) => {
                              const customCycle = cycleEntry[row.vType];
                              const isCustomized = customCycle !== undefined;
                              const isFirst = rowIdx === 0;
                              const isLast = rowIdx === variantRows.length - 1;
                              const rowBorderClass = !isLast
                                ? "border-b border-dashed border-slate-100"
                                : "";

                              return (
                                <tr
                                  key={p.id + "-" + row.vType}
                                  className={
                                    "transition-all " +
                                    (isCustomized ? "bg-indigo-50/30" : "hover:bg-slate-50/50")
                                  }
                                >
                                  {isFirst && (
                                    <td
                                      className="px-8 py-4 align-middle"
                                      rowSpan={variantRows.length}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={
                                            "w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 " +
                                            (isAnyCustomized
                                              ? "bg-indigo-100 text-indigo-600"
                                              : "bg-slate-100 text-slate-500")
                                          }
                                        >
                                          {p.id}
                                        </div>
                                        <div>
                                          <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug max-w-[280px]">
                                            {p.name}
                                          </p>
                                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            SKU: DES-{String(p.id).padStart(3, "0")}
                                          </p>
                                          {hasBothSizes && (
                                            <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md mt-1.5 inline-block tracking-wider">
                                              2 SIZE
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  )}

                                  <td className={"px-6 py-3.5 text-center " + rowBorderClass}>
                                    <div
                                      className={
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-[10px] uppercase " +
                                        row.bgClass +
                                        " " +
                                        row.borderClass +
                                        " " +
                                        row.colorClass
                                      }
                                    >
                                      <span>{row.label}</span>
                                      <span className="opacity-50">·</span>
                                      <span>{row.v?.size}</span>
                                    </div>
                                  </td>

                                  <td className={"px-6 py-3.5 text-center " + rowBorderClass}>
                                    <span className="text-sm font-black text-slate-400">
                                      {config.refillCycleDays} ngày
                                    </span>
                                  </td>

                                  <td className={"px-6 py-3.5 text-center " + rowBorderClass}>
                                    <div className="flex items-center justify-center gap-2">
                                      <Input
                                        type="number"
                                        min={1}
                                        max={365}
                                        placeholder={String(config.refillCycleDays)}
                                        value={customCycle ?? ""}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value);
                                          if (!isNaN(val) && val > 0)
                                            handleCycleChange(p.id, row.vType, val);
                                          else if (e.target.value === "")
                                            handleResetCycle(p.id, row.vType);
                                        }}
                                        className={
                                          "w-24 h-9 rounded-xl text-center font-black text-sm transition-all " +
                                          (isCustomized
                                            ? "border-indigo-300 bg-white text-indigo-700 shadow-sm shadow-indigo-100 ring-1 ring-indigo-200"
                                            : "border-slate-200 bg-slate-50 text-slate-600")
                                        }
                                      />
                                      <span className="text-xs font-bold text-slate-400">ngày</span>
                                      {isCustomized && (
                                        <button
                                          onClick={() => handleResetCycle(p.id, row.vType)}
                                          title="Về mặc định"
                                          className="w-6 h-6 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 flex items-center justify-center transition-all"
                                        >
                                          <RefreshCw className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                  <td className={"px-6 py-3.5 text-center " + rowBorderClass}>
                                    {isCustomized ? (
                                      <Badge
                                        className={
                                          "text-white border-none text-[9px] font-black px-2.5 py-1 rounded-full " +
                                          (row.vType === "retail" ? "bg-blue-600" : "bg-purple-600")
                                        }
                                      >
                                        ✦ {row.label}
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="border-slate-200 text-slate-400 text-[9px] font-black px-2.5 py-1 rounded-full"
                                      >
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
                <CardTitle className="text-lg font-black text-slate-900">
                  Tùy chọn Hệ thống
                </CardTitle>
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
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Ngôn ngữ cho toàn bộ nhân viên
                        </p>
                      </div>
                    </div>
                    <select
                      className="bg-transparent font-bold text-sm outline-none"
                      value={config.systemLanguage}
                      onChange={(e) => setConfig({ ...config, systemLanguage: e.target.value })}
                    >
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
                        <p className="text-sm font-black text-slate-900">
                          Chế độ giao diện (Dark Mode)
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Tùy chỉnh theo môi trường làm việc
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={config.darkMode}
                      onCheckedChange={(checked) => setConfig({ ...config, darkMode: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-pink-500">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          Thông báo Đẩy (Push Notifications)
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Cảnh báo tức thời trên trình duyệt
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={config.enableNotifications}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, enableNotifications: checked })
                      }
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
                <CardTitle className="text-lg font-black text-slate-900">
                  Bảo mật & Quyền riêng tư
                </CardTitle>
                <CardDescription>
                  Các thiết lập bảo mật cấp cao (Sắp ra mắt trong phiên bản tới)
                </CardDescription>
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
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Bắt buộc với Admin & Sub-admin
                        </p>
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
                        <p className="text-sm font-black text-slate-900">
                          Chính sách Mật khẩu mạnh
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Yêu cầu chữ hoa, số và ký tự đặc biệt
                        </p>
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
                        <p className="text-sm font-black text-slate-900">
                          Tự động đăng xuất (Timeout)
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Khi không có hoạt động quá 30 phút
                        </p>
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
                <CardTitle className="text-xl font-black text-slate-900">
                  Nhân sự & Phân quyền
                </CardTitle>
                <CardDescription>Quản lý tài khoản và phân quyền truy cập hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 flex flex-col items-center justify-center space-y-6">
                <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-2 border-4 border-indigo-100/50">
                  <Users className="w-10 h-10" />
                </div>
                <p className="text-sm font-medium text-slate-500 text-center max-w-md">
                  Tính năng tạo tài khoản và phân quyền (Admin, Sale, Telesale) đã được chuyển sang
                  một không gian chuyên biệt để quản lý trực quan hơn.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-indigo-600 font-black shadow-lg shadow-slate-200 transition-all hover:-translate-y-1 mt-4"
                >
                  <Link to="/admin/users">
                    <Users className="w-5 h-5 mr-3" /> Mở Quản lý Nhân sự
                  </Link>
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
