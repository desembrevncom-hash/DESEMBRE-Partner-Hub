import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_BRANDING, type BrandSettings } from "@/config/branding";
import {
  Sparkles,
  Upload,
  Save,
  RotateCcw,
  ArrowLeft,
  Image as ImageIcon,
  CheckCircle2,
  Globe,
  Smartphone,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/branding")({
  component: AdminBrandingPage,
});

const ALLOWED_MIME_TYPES = [
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function AdminBrandingPage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<BrandSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const fileInputRefs = {
    header_logo_url: useRef<HTMLInputElement>(null),
    logo_mark_url: useRef<HTMLInputElement>(null),
    favicon_url: useRef<HTMLInputElement>(null),
    apple_touch_icon_url: useRef<HTMLInputElement>(null),
  };

  const isAuthorized = isAdmin || isSubAdmin;

  // Load current branding settings from DB
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("brand_settings" as any)
          .select("*")
          .eq("id", "default")
          .maybeSingle();

        if (error) {
          console.warn("[AdminBranding] Error fetching brand settings:", error);
          setSettings(DEFAULT_BRANDING);
        } else if (data) {
          setSettings({
            id: data.id || "default",
            site_name: data.site_name || DEFAULT_BRANDING.site_name,
            header_logo_url: data.header_logo_url || DEFAULT_BRANDING.header_logo_url,
            logo_mark_url: data.logo_mark_url || DEFAULT_BRANDING.logo_mark_url,
            favicon_url: data.favicon_url || DEFAULT_BRANDING.favicon_url,
            apple_touch_icon_url: data.apple_touch_icon_url || DEFAULT_BRANDING.apple_touch_icon_url,
            updated_at: data.updated_at,
          });
        }
      } catch (err) {
        console.error("[AdminBranding] Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    }

    if (isAuthorized) {
      loadSettings();
    }
  }, [isAuthorized]);

  // Handle file upload to Supabase Storage: branding-assets
  const handleFileUpload = async (
    field: "header_logo_url" | "logo_mark_url" | "favicon_url" | "apple_touch_icon_url",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error("Định dạng file không hỗ trợ. Vui lòng chọn SVG, PNG, JPEG hoặc WebP.");
      return;
    }

    // 2. Validate file size (5MB for header logo, 2MB for others)
    const maxSize = field === "header_logo_url" ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxMb = maxSize / (1024 * 1024);
      toast.error(`Dung lượng file quá lớn. Tối đa ${maxMb}MB.`);
      return;
    }

    try {
      setUploadingField(field);
      const ext = file.name.split(".").pop() || "png";
      const cleanFileName = `${field}-${Date.now()}.${ext}`;
      const filePath = `logos/${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("branding-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        console.error("[AdminBranding] Storage upload error:", uploadError);
        toast.error(`Tải file lên thất bại: ${uploadError.message}`);
        return;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("branding-assets")
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        toast.error("Không tạo được liên kết công khai cho ảnh.");
        return;
      }

      const uploadedUrl = publicUrlData.publicUrl;

      // Update state
      setSettings((prev) => ({
        ...prev,
        [field]: uploadedUrl,
      }));

      toast.success("Tải ảnh lên thành công! Bấm 'Lưu Cấu Hình' để áp dụng.");
    } catch (err: any) {
      console.error("[AdminBranding] Upload error:", err);
      toast.error(`Lỗi khi tải file: ${err.message}`);
    } finally {
      setUploadingField(null);
      if (e.target) e.target.value = "";
    }
  };

  // Save branding settings to DB
  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        id: "default",
        site_name: settings.site_name.trim() || DEFAULT_BRANDING.site_name,
        header_logo_url: settings.header_logo_url?.trim() || null,
        logo_mark_url: settings.logo_mark_url?.trim() || null,
        favicon_url: settings.favicon_url?.trim() || null,
        apple_touch_icon_url: settings.apple_touch_icon_url?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("brand_settings" as any)
        .upsert(payload, { onConflict: "id" });

      if (error) {
        console.error("[AdminBranding] Save error:", error);
        toast.error(`Lưu thất bại: ${error.message}`);
        return;
      }

      toast.success("Cập nhật nhận diện thương hiệu thành công!");
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Reset to default assets
  const handleReset = () => {
    setSettings(DEFAULT_BRANDING);
    toast.info("Đã đặt lại về tài sản mặc định. Bấm 'Lưu Cấu Hình' để lưu.");
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500">Đang tải cấu hình thương hiệu...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="container mx-auto max-w-lg p-6 my-16 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-black text-slate-900">Không có quyền truy cập</h2>
        <p className="text-xs text-slate-500">Chỉ quản trị viên mới có thể thay đổi nhận diện thương hiệu.</p>
        <Button asChild className="rounded-xl font-bold text-xs bg-slate-900 text-white">
          <Link to="/workspace">Về Workspace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl p-6 sm:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="h-8 px-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-900">
              <Link to="/admin/settings">
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span>Cài đặt hệ thống</span>
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            Nhận Diện Thương Hiệu (Dynamic Branding)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Tải lên và thay đổi Logo, Favicon và tên thương hiệu cho website công khai (`/san-pham`) mà không cần sửa mã nguồn.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleReset}
            className="rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định</span>
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Đang lưu..." : "Lưu Cấu Hình"}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Site Name Card */}
          <Card className="rounded-3xl border-slate-200 shadow-2xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                Tên Website &amp; Tiêu Đề Công Khai
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Hiển thị trên thanh tiêu đề, Header trang catalog `/san-pham` và Footer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site_name" className="text-xs font-bold text-slate-700">
                  Tên Thương Hiệu (Site Name)
                </Label>
                <Input
                  id="site_name"
                  value={settings.site_name}
                  onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                  placeholder="DESEMBRE HUB"
                  className="rounded-xl border-slate-200 text-sm font-semibold focus-visible:ring-indigo-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Logo Mark (Square Icon) */}
          <Card className="rounded-3xl border-slate-200 shadow-2xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                Biểu Tượng Logo Vuông (Logo Mark)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Dùng cho Header `/san-pham`, Footer và góc trái ứng dụng. Tỷ lệ 1:1 (Khuyên dùng SVG hoặc PNG trong suốt, tối đa 2MB).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 p-2 flex items-center justify-center shrink-0 shadow-2xs">
                  <img
                    src={settings.logo_mark_url || DEFAULT_BRANDING.logo_mark_url!}
                    alt="Logo Mark Preview"
                    className="w-full h-full object-contain rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_BRANDING.logo_mark_url!;
                    }}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    value={settings.logo_mark_url || ""}
                    onChange={(e) => setSettings({ ...settings, logo_mark_url: e.target.value })}
                    placeholder="Đường dẫn URL hoặc tải file từ máy..."
                    className="rounded-xl border-slate-200 text-xs font-medium"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRefs.logo_mark_url}
                      accept=".svg,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={(e) => handleFileUpload("logo_mark_url", e)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingField === "logo_mark_url"}
                      onClick={() => fileInputRefs.logo_mark_url.current?.click()}
                      className="rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 text-indigo-600 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingField === "logo_mark_url" ? "Đang tải lên..." : "Tải file lên (SVG / PNG)"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Favicon & Tab Icon */}
          <Card className="rounded-3xl border-slate-200 shadow-2xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                Browser Favicon (Biểu Tượng Tab Trình Duyệt)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Hiển thị trên tab trình duyệt và bookmark. Khuyên dùng SVG hoặc ICO/PNG 32x32, tối đa 2MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 p-2 flex items-center justify-center shrink-0 shadow-2xs">
                  <img
                    src={settings.favicon_url || DEFAULT_BRANDING.favicon_url!}
                    alt="Favicon Preview"
                    className="w-full h-full object-contain rounded-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_BRANDING.favicon_url!;
                    }}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    value={settings.favicon_url || ""}
                    onChange={(e) => setSettings({ ...settings, favicon_url: e.target.value })}
                    placeholder="Đường dẫn URL Favicon..."
                    className="rounded-xl border-slate-200 text-xs font-medium"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRefs.favicon_url}
                      accept=".svg,.png,.ico,.webp"
                      className="hidden"
                      onChange={(e) => handleFileUpload("favicon_url", e)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingField === "favicon_url"}
                      onClick={() => fileInputRefs.favicon_url.current?.click()}
                      className="rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 text-emerald-600 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingField === "favicon_url" ? "Đang tải lên..." : "Tải Favicon mới"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Header Full Logo (Optional Wide Logo) */}
          <Card className="rounded-3xl border-slate-200 shadow-2xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-600" />
                Logo Dài Hoàn Chỉnh (Full Header Logo)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Logo bao gồm cả hình và chữ ngang cho banner hoặc landing page. Tối đa 5MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  value={settings.header_logo_url || ""}
                  onChange={(e) => setSettings({ ...settings, header_logo_url: e.target.value })}
                  placeholder="Đường dẫn Full Logo..."
                  className="rounded-xl border-slate-200 text-xs font-medium"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRefs.header_logo_url}
                    accept=".svg,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => handleFileUpload("header_logo_url", e)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingField === "header_logo_url"}
                    onClick={() => fileInputRefs.header_logo_url.current?.click()}
                    className="rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 text-amber-600 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingField === "header_logo_url" ? "Đang tải lên..." : "Tải Full Logo (Max 5MB)"}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-6 sticky top-24">
          <Card className="rounded-3xl border-slate-200 shadow-sm bg-gradient-to-b from-slate-50/50 to-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                Xem Trước Thực Tế (Live Preview)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Mô phỏng hiển thị trên thanh Header `/san-pham` và Tab trình duyệt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Browser Tab Simulation */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  1. Tab Trình Duyệt
                </span>
                <div className="bg-slate-200/80 p-2.5 rounded-2xl">
                  <div className="bg-white rounded-xl px-3 py-2 flex items-center gap-2 shadow-2xs max-w-xs border border-slate-200/60">
                    <img
                      src={settings.favicon_url || DEFAULT_BRANDING.favicon_url!}
                      alt="Favicon"
                      className="w-4 h-4 object-contain rounded-xs"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_BRANDING.favicon_url!;
                      }}
                    />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {settings.site_name} | Mỹ phẩm sinh học
                    </span>
                  </div>
                </div>
              </div>

              {/* Public Header Simulation */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  2. Header Công Khai (/san-pham)
                </span>
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={settings.logo_mark_url || DEFAULT_BRANDING.logo_mark_url!}
                        alt="Header Logo"
                        className="w-9 h-9 rounded-xl object-contain shadow-2xs"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_BRANDING.logo_mark_url!;
                        }}
                      />
                      <span className="text-base font-black tracking-tighter flex items-center text-slate-900">
                        {settings.site_name}
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 ml-1.5" />
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">0333.60.26.26</span>
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-2xs">
                        Partner
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Link to Public Site */}
              <div className="pt-2">
                <Button asChild variant="outline" className="w-full rounded-2xl font-bold text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2">
                  <Link to="/san-pham" target="_blank">
                    <span>Mở trang /san-pham kiểm tra</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
