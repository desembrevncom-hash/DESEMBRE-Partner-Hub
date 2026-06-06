import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Printer, Save, CheckCircle, FileText, Plus, Trash } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { A4PreviewFrame } from "./A4PreviewFrame";
import { renderTemplate } from "@/lib/documentTemplates";

interface ProductSalesSheetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  catalogProductId: string;
  productName: string;
  brandId: string;
  categoryName?: string;
  imageUrl?: string;
  productCode?: string;
  onSaved?: () => void;
}

const DEFAULT_HTML_TEMPLATE = `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; color: #1e293b; padding: 5px;">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px;">
    <div>
      <span style="font-size: 10px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.1em;">PRODUCT SALES SHEET</span>
      <h1 style="font-size: 22px; font-weight: 900; margin: 4px 0 0 0; color: #0f172a; text-transform: uppercase; line-height: 1.2;">{{product.name}}</h1>
      <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0;">Thương hiệu: <strong>{{product.brand_name}}</strong> | Danh mục: <strong>{{product.category_name}}</strong></p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: 1px;">DESEMBRE</div>
      <div style="font-size: 8px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; font-weight: 700;">Premium Cosmetics</div>
    </div>
  </div>

  <!-- Content Grid -->
  <div style="display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 20px; margin-bottom: 15px;">
    <!-- Left Column: Image & Pricing -->
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <!-- Product Image wrapper -->
      <div style="background: #f8fafc; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #e2e8f0; min-height: 150px; display: flex; align-items: center; justify-content: center;">
        <img src="{{product.image_url}}" alt="{{product.name}}" style="max-width: 100%; max-height: 140px; object-fit: contain;" />
      </div>

      <!-- Pricing Table -->
      <div style="background: #ffffff; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0;">
        <h3 style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 8px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; letter-spacing: 0.5px;">BẢNG GIÁ SẢN PHẨM</h3>
        <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
          <thead>
            <tr style="color: #64748b; font-weight: 700; text-align: left;">
              <th style="padding: 4px 0;">Kênh</th>
              <th style="padding: 4px 0;">Dung tích</th>
              <th style="padding: 4px 0; text-align: right;">Giá niêm yết</th>
            </tr>
          </thead>
          <tbody>
            {{#each variants}}
            <tr style="border-top: 1px solid #f1f5f9; color: #334155;">
              <td style="padding: 5px 0; font-weight: 600; text-transform: uppercase; font-size: 9px; color: #475569;">{{channel}}</td>
              <td style="padding: 5px 0;">{{size_label}}</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 800; color: #2563eb;">{{price}}</td>
            </tr>
            {{/each}}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Right Column: Product Knowledge -->
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <!-- Short Description -->
      <div style="background: #eff6ff; border-left: 3px solid #2563eb; border-radius: 0 6px 6px 0; padding: 10px 12px;">
        <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #1e3a8a; font-style: italic;">
          {{product.short_description}}
        </p>
      </div>

      <!-- Key Benefits -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">CÔNG DỤNG NỔI BẬT</h4>
        <div style="font-size: 10px; line-height: 1.4; color: #334155; white-space: pre-line;">{{knowledge.benefits}}</div>
      </div>

      <!-- Suitable Skin Types -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">LOẠI DA PHÙ HỢP</h4>
        <div style="font-size: 10px; line-height: 1.4; color: #334155;">{{knowledge.skin_types}}</div>
      </div>

      <!-- How to use -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">HƯỚNG DẪN SỬ DỤNG</h4>
        <div style="font-size: 10px; line-height: 1.4; color: #334155; white-space: pre-line;">{{knowledge.usage}}</div>
      </div>

      <!-- Sales Notes & Warnings Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        <div>
          <h4 style="font-size: 10px; font-weight: 800; color: #d97706; margin: 0 0 2px 0; text-transform: uppercase;">LƯU Ý TƯ VẤN</h4>
          <div style="font-size: 9px; line-height: 1.3; color: #451a03; white-space: pre-line;">{{knowledge.sales_notes}}</div>
        </div>
        <div>
          <h4 style="font-size: 10px; font-weight: 800; color: #dc2626; margin: 0 0 2px 0; text-transform: uppercase;">CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.3; color: #450a0a; white-space: pre-line;">{{knowledge.warnings}}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8;">
    <div>{{footer_note}}</div>
    <div>Tài liệu lưu hành nội bộ | Desembre VN</div>
  </div>
</div>
`;

interface SalesSheetContent {
  product: {
    name: string;
    brand_name: string;
    category_name: string;
    short_description: string;
  };
  pricing: {
    retail: Array<{ sku: string; size_label: string; price: string }>;
    salon: Array<{ sku: string; size_label: string; price: string }>;
  };
  knowledge: {
    benefits: string[];
    skin_types: string[];
    usage: string[];
    sales_notes: string[];
    warnings: string[];
  };
  footer_note: string;
}

export function ProductSalesSheetDialog({
  isOpen,
  onClose,
  catalogProductId,
  productName,
  brandId,
  categoryName = "Chưa rõ",
  imageUrl = "",
  productCode = "",
  onSaved,
}: ProductSalesSheetDialogProps) {
  const { user, roles } = useAuth();
  const isAdminOrSub = roles.some((r) => ["admin", "sub_admin"].includes(r));

  // States
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  // Sales Sheet record states
  const [salesSheetId, setSalesSheetId] = useState<string | null>(null);
  const [title, setTitle] = useState(`Sales Sheet - ${productName}`);
  const [status, setStatus] = useState<"draft" | "approved" | "archived">("draft");
  
  // Content JSON state
  const [contentJson, setContentJson] = useState<SalesSheetContent>({
    product: {
      name: productName,
      brand_name: "",
      category_name: categoryName,
      short_description: "",
    },
    pricing: { retail: [], salon: [] },
    knowledge: {
      benefits: [],
      skin_types: [],
      usage: [],
      sales_notes: [],
      warnings: [],
    },
    footer_note: "Tài liệu lưu hành nội bộ Desembre.",
  });

  // Load Templates & Existing Sheet Data
  useEffect(() => {
    if (isOpen && catalogProductId) {
      loadData();
    }
  }, [isOpen, catalogProductId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch available templates
      const { data: templatesData, error: tErr } = await supabase
        .from("document_templates")
        .select("id, name, html_template, status")
        .eq("template_type", "product_sales_sheet");

      if (tErr) throw tErr;
      setTemplates(templatesData || []);

      // 2. Fetch existing sales sheet
      const { data: sheetData, error: sErr } = await supabase
        .from("product_sales_sheets")
        .select("*")
        .eq("catalog_product_id", catalogProductId)
        .maybeSingle();

      if (sErr) throw sErr;

      if (sheetData) {
        setSalesSheetId(sheetData.id);
        setTitle(sheetData.title);
        setStatus(sheetData.status as any);
        setSelectedTemplateId(sheetData.template_id || "");
        if (sheetData.content_json) {
          setContentJson(sheetData.content_json as any);
        }
      } else {
        // Clear state for new sheet
        setSalesSheetId(null);
        setTitle(`Sales Sheet - ${productName}`);
        setStatus("draft");
        setSelectedTemplateId(templatesData?.[0]?.id || "");
        setContentJson({
          product: {
            name: productName,
            brand_name: "",
            category_name: categoryName,
            short_description: "",
          },
          pricing: { retail: [], salon: [] },
          knowledge: {
            benefits: [],
            skin_types: [],
            usage: [],
            sales_notes: [],
            warnings: [],
          },
          footer_note: "Tài liệu lưu hành nội bộ Desembre.",
        });
      }
    } catch (e: any) {
      toast.error("Lỗi khi tải dữ liệu: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate via AI Edge Function
  const handleGenerateAI = async () => {
    if (!isAdminOrSub) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-sales-sheet", {
        body: {
          catalogProductId,
          templateId: selectedTemplateId || null,
        },
      });

      if (error) throw error;
      if (!data || !data.success) {
        throw new Error(data?.error || "AI generation returned success=false");
      }

      setTitle(data.title || `Sales Sheet - ${productName}`);
      if (data.content_json) {
        setContentJson(data.content_json);
      }
      toast.success("Sinh dữ liệu Sales Sheet thành công!");
    } catch (e: any) {
      console.error(e);
      toast.error("Lỗi sinh AI: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  // Save changes
  const handleSave = async (newStatus?: "draft" | "approved" | "archived") => {
    if (!isAdminOrSub) return;
    setSaving(true);
    const targetStatus = newStatus || status;
    try {
      const payload: any = {
        brand_id: brandId,
        catalog_product_id: catalogProductId,
        template_id: selectedTemplateId || null,
        title,
        content_json: contentJson,
        status: targetStatus,
      };

      if (salesSheetId) {
        // Update
        const updatePayload = {
          ...payload,
          updated_at: new Date().toISOString(),
        };

        if (targetStatus === "approved") {
          updatePayload.approved_by = user?.id || null;
          updatePayload.approved_at = new Date().toISOString();
        } else if (targetStatus === "draft") {
          updatePayload.approved_by = null;
          updatePayload.approved_at = null;
        }

        const { error } = await supabase
          .from("product_sales_sheets")
          .update(updatePayload)
          .eq("id", salesSheetId);
        
        if (error) throw error;
        toast.success(`Cập nhật Sales Sheet (${targetStatus}) thành công!`);
      } else {
        // Create
        const insertPayload = {
          ...payload,
          generated_by: user?.id || null,
        };

        if (targetStatus === "approved") {
          insertPayload.approved_by = user?.id || null;
          insertPayload.approved_at = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from("product_sales_sheets")
          .insert(insertPayload)
          .select("id")
          .single();

        if (error) throw error;
        setSalesSheetId(data.id);
        toast.success(`Tạo mới Sales Sheet (${targetStatus}) thành công!`);
      }

      setStatus(targetStatus);
      if (onSaved) {
        onSaved();
      }
      if (newStatus) {
        onClose();
      }
    } catch (e: any) {
      toast.error("Lỗi lưu dữ liệu: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Render variables for A4 Preview Frame
  const activeTemplateHtml = useMemo(() => {
    const matched = templates.find((t) => t.id === selectedTemplateId);
    return matched?.html_template || DEFAULT_HTML_TEMPLATE;
  }, [templates, selectedTemplateId]);

  const previewHtml = useMemo(() => {
    // Adapter to transform content_json structure into matching formats expected by the template
    const joinList = (val: any) => {
      if (Array.isArray(val)) return val.map(v => `- ${v}`).join("\n");
      return val || "";
    };

    const retailList = contentJson.pricing?.retail || [];
    const salonList = contentJson.pricing?.salon || [];
    
    const formattedVariants = [
      ...retailList.map((v) => ({ ...v, channel: "retail" })),
      ...salonList.map((v) => ({ ...v, channel: "salon" })),
    ];

    const dataForRendering = {
      product: {
        name: contentJson.product?.name || productName,
        brand_name: contentJson.product?.brand_name || "",
        category_name: contentJson.product?.category_name || categoryName,
        short_description: contentJson.product?.short_description || "",
        image_url: imageUrl || "",
        product_code: productCode || "",
      },
      pricing: contentJson.pricing || { retail: [], salon: [] },
      variants: formattedVariants,
      knowledge: {
        benefits: joinList(contentJson.knowledge?.benefits),
        skin_types: joinList(contentJson.knowledge?.skin_types),
        usage: joinList(contentJson.knowledge?.usage),
        sales_notes: joinList(contentJson.knowledge?.sales_notes),
        warnings: joinList(contentJson.knowledge?.warnings),
      },
      footer_note: contentJson.footer_note || "",
    };

    return renderTemplate(activeTemplateHtml, dataForRendering);
  }, [contentJson, activeTemplateHtml, productName, categoryName, imageUrl, productCode]);

  // Form Field Changers
  const handleProductField = (field: string, value: string) => {
    setContentJson((prev) => ({
      ...prev,
      product: {
        ...prev.product,
        [field]: value,
      },
    }));
  };

  const handlePricingField = (type: "retail" | "salon", index: number, field: string, value: string) => {
    setContentJson((prev) => {
      const list = [...(prev.pricing[type] || [])];
      list[index] = { ...list[index], [field]: value };
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          [type]: list,
        },
      };
    });
  };

  const handleAddPricingRow = (type: "retail" | "salon") => {
    setContentJson((prev) => {
      const list = [...(prev.pricing[type] || [])];
      list.push({ sku: "", size_label: "", price: "" });
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          [type]: list,
        },
      };
    });
  };

  const handleRemovePricingRow = (type: "retail" | "salon", index: number) => {
    setContentJson((prev) => {
      const list = prev.pricing[type].filter((_, i) => i !== index);
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          [type]: list,
        },
      };
    });
  };

  const handleKnowledgeFieldChange = (field: keyof SalesSheetContent["knowledge"], index: number, value: string) => {
    setContentJson((prev) => {
      const list = [...(prev.knowledge[field] || [])];
      list[index] = value;
      return {
        ...prev,
        knowledge: {
          ...prev.knowledge,
          [field]: list,
        },
      };
    });
  };

  const handleAddKnowledgeItem = (field: keyof SalesSheetContent["knowledge"]) => {
    setContentJson((prev) => {
      const list = [...(prev.knowledge[field] || [])];
      list.push("");
      return {
        ...prev,
        knowledge: {
          ...prev.knowledge,
          [field]: list,
        },
      };
    });
  };

  const handleRemoveKnowledgeItem = (field: keyof SalesSheetContent["knowledge"], index: number) => {
    setContentJson((prev) => {
      const list = prev.knowledge[field].filter((_, i) => i !== index);
      return {
        ...prev,
        knowledge: {
          ...prev.knowledge,
          [field]: list,
        },
      };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-7xl h-[92vh] flex flex-col p-0 bg-white border border-slate-200 shadow-xl overflow-hidden rounded-xl">
        <DialogHeader className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Tài liệu Product Sales Sheet (A4)
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              {productName} &bull; Trạng thái hiện tại: <span className="font-bold text-indigo-600 uppercase">{status}</span>
            </p>
          </div>
          <div className="flex gap-2 mr-6">
            {isAdminOrSub && (
              <>
                <Button
                  onClick={handleGenerateAI}
                  disabled={generating || loading}
                  variant="outline"
                  className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang sinh AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 text-indigo-600 animate-pulse" />
                      Tạo bằng AI (OpenAI)
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleSave("draft")}
                  disabled={saving || loading}
                  variant="outline"
                  className="font-bold"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Lưu nháp
                </Button>
                <Button
                  onClick={() => handleSave("approved")}
                  disabled={saving || loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Duyệt Sheet (Approved)
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-500">Đang tải dữ liệu Sales Sheet...</p>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel: Fields inputs (Only Editable by Admin/Sub-admin) */}
            <div className="w-full md:w-1/2 border-r border-slate-200 flex flex-col overflow-y-auto bg-slate-50 p-6 space-y-6">
              {!isAdminOrSub && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs font-bold mb-4">
                  Chế độ Xem trước: Sales và Telesales chỉ có quyền xem bản đã duyệt và in tài liệu.
                </div>
              )}

              {/* Title and Template Selector */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 uppercase tracking-wide">
                  Cấu hình Sheet
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500">Tiêu đề Sales Sheet</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={!isAdminOrSub}
                      className="border-slate-200 text-slate-800 font-medium"
                      placeholder="Nhập tiêu đề sheet..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500">Chọn mẫu giao diện (Template)</Label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      disabled={!isAdminOrSub}
                      className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">-- Mẫu mặc định của hệ thống --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* General Product Info */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 uppercase tracking-wide">
                  Thông tin sản phẩm
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500">Tên hiển thị</Label>
                    <Input
                      value={contentJson.product.name}
                      onChange={(e) => handleProductField("name", e.target.value)}
                      disabled={!isAdminOrSub}
                      className="border-slate-200 text-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500">Thương hiệu</Label>
                    <Input
                      value={contentJson.product.brand_name}
                      onChange={(e) => handleProductField("brand_name", e.target.value)}
                      disabled={!isAdminOrSub}
                      placeholder="Desembre"
                      className="border-slate-200 text-slate-800"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-500">Mô tả ngắn gọn (Short Description)</Label>
                  <Textarea
                    value={contentJson.product.short_description}
                    onChange={(e) => handleProductField("short_description", e.target.value)}
                    disabled={!isAdminOrSub}
                    placeholder="Mô tả tóm tắt ngắn..."
                    className="border-slate-200 text-slate-800 min-h-[60px]"
                  />
                </div>
              </div>

              {/* Retail and Salon Pricing */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                    Phân khúc giá bán lẻ (Retail)
                  </h3>
                  {isAdminOrSub && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddPricingRow("retail")}
                      className="h-7 text-xs border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Thêm size
                    </Button>
                  )}
                </div>
                {contentJson.pricing?.retail?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa có thông tin giá lẻ.</p>
                ) : (
                  <div className="space-y-3">
                    {contentJson.pricing?.retail?.map((row, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="SKU"
                          value={row.sku}
                          onChange={(e) => handlePricingField("retail", index, "sku", e.target.value)}
                          disabled={!isAdminOrSub}
                          className="h-8 text-xs border-slate-200 w-1/4"
                        />
                        <Input
                          placeholder="Dung tích (vd: 150ml)"
                          value={row.size_label}
                          onChange={(e) => handlePricingField("retail", index, "size_label", e.target.value)}
                          disabled={!isAdminOrSub}
                          className="h-8 text-xs border-slate-200 w-1/3"
                        />
                        <Input
                          placeholder="Giá niêm yết (vd: 650,000đ)"
                          value={row.price}
                          onChange={(e) => handlePricingField("retail", index, "price", e.target.value)}
                          disabled={!isAdminOrSub}
                          className="h-8 text-xs border-slate-200 w-1/3"
                        />
                        {isAdminOrSub && (
                          <button
                            onClick={() => handleRemovePricingRow("retail", index)}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center border-b border-slate-100 pt-4 pb-2">
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                    Phân khúc giá Spa/Salon (Salon)
                  </h3>
                  {isAdminOrSub && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddPricingRow("salon")}
                      className="h-7 text-xs border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Thêm size
                    </Button>
                  )}
                </div>
                {contentJson.pricing?.salon?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa có thông tin giá chuyên nghiệp.</p>
                ) : (
                  <div className="space-y-3">
                    {contentJson.pricing?.salon?.map((row, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="SKU"
                          value={row.sku}
                          onChange={(e) => handlePricingField("salon", index, "sku", e.target.value)}
                          disabled={!isAdminOrSub}
                          className="h-8 text-xs border-slate-200 w-1/4"
                        />
                        <Input
                          placeholder="Dung tích (vd: 1000ml)"
                          value={row.size_label}
                          onChange={(e) => handlePricingField("salon", index, "size_label", e.target.value)}
                          disabled={!isAdminOrSub}
                          className="h-8 text-xs border-slate-200 w-1/3"
                        />
                        <Input
                          placeholder="Giá chuyên nghiệp (vd: 1,650,000đ)"
                          value={row.price}
                          onChange={(e) => handlePricingField("salon", index, "price", e.target.value)}
                          disabled={!isAdminOrSub}
                          className="h-8 text-xs border-slate-200 w-1/3"
                        />
                        {isAdminOrSub && (
                          <button
                            onClick={() => handleRemovePricingRow("salon", index)}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Knowledge Lists */}
              {([
                { key: "benefits", label: "Công dụng chính (Benefits)" },
                { key: "skin_types", label: "Loại da phù hợp" },
                { key: "usage", label: "Hướng dẫn sử dụng (Usage)" },
                { key: "sales_notes", label: "Lưu ý tư vấn bán hàng" },
                { key: "warnings", label: "Cảnh báo / Chống chỉ định" },
              ] as const).map(({ key, label }) => (
                <div key={key} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                      {label}
                    </h3>
                    {isAdminOrSub && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddKnowledgeItem(key)}
                        className="h-7 text-xs border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Thêm dòng
                      </Button>
                    )}
                  </div>
                  {(!contentJson.knowledge?.[key] || contentJson.knowledge?.[key]?.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Chưa có dữ liệu.</p>
                  ) : (
                    <div className="space-y-2">
                      {contentJson.knowledge?.[key]?.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            value={item}
                            onChange={(e) => handleKnowledgeFieldChange(key, index, e.target.value)}
                            disabled={!isAdminOrSub}
                            className="h-8 text-xs border-slate-200 w-full"
                          />
                          {isAdminOrSub && (
                            <button
                              onClick={() => handleRemoveKnowledgeItem(key, index)}
                              className="text-slate-400 hover:text-red-500 p-1"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Footer Note */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 uppercase tracking-wide">
                  Ghi chú chân trang (Footer Note)
                </h3>
                <div className="space-y-1.5">
                  <Textarea
                    value={contentJson.footer_note}
                    onChange={(e) => setContentJson((prev) => ({ ...prev, footer_note: e.target.value }))}
                    disabled={!isAdminOrSub}
                    placeholder="Nhập ghi chú chân trang..."
                    className="border-slate-200 text-slate-800 min-h-[60px]"
                  />
                </div>
              </div>
            </div>

            {/* Right Panel: Live A4 Preview */}
            <div className="hidden md:block w-1/2 bg-slate-100 relative">
              <A4PreviewFrame htmlContent={previewHtml} title={title} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
