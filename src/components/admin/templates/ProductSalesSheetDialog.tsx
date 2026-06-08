import React, { useState, useEffect, useMemo, useRef } from "react";
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
<div style="font-family: 'Inter', sans-serif; max-width: 100%; color: #1e293b; line-height: 1.4; padding: 5px;">
  <!-- Premium Header -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px;">
    <div>
      <span style="font-size: 9px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.15em; background: #fef3c7; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a;">TÀI LIỆU ĐÀO TẠO NỘI BỘ</span>
      <h1 style="font-size: 20px; font-weight: 900; margin: 6px 0 2px 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">{{product.name}}</h1>
      <p style="font-size: 11px; color: #64748b; margin: 0;">Thương hiệu: <strong style="color: #1e3a8a;">{{product.brand_name}}</strong> | Danh mục: <strong>{{product.category_name}}</strong></p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 18px; font-weight: 900; color: #1e3a8a; letter-spacing: 1px; line-height: 1;">DESEMBRE</div>
      <div style="font-size: 8px; color: #94a3b8; margin-top: 3px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Luxury Cosmetics</div>
    </div>
  </div>

  <!-- Content Structure -->
  <div style="display: grid; grid-template-columns: 1.25fr 1.75fr; gap: 18px;">
    <!-- Left Panel: Product Image and Pricing Table -->
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <!-- Styled Product Frame -->
      <div style="background: #ffffff; border-radius: 12px; padding: 12px; text-align: center; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); min-height: 180px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
        {{#if product.image_url}}
          <img src="{{product.image_url}}" alt="{{product.name}}" style="max-width: 100%; max-height: 160px; object-fit: contain;" />
        {{else}}
          <!-- Fallback image block -->
          <div style="font-size: 11px; color: #94a3b8; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <svg style="width: 32px; height: 32px; stroke: #cbd5e1; fill: none; stroke-width: 1.5;" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            Không có hình ảnh
          </div>
        {{/if}}
      </div>

      <!-- Pricing Info Block -->
      <div style="background: #ffffff; border-radius: 12px; padding: 14px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
        <h3 style="font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin: 0 0 10px 0; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 5px; letter-spacing: 0.5px; display: flex; justify-content: space-between;">
          <span>BẢNG GIÁ ĐỐI TÁC</span>
          <span style="color: #64748b; font-size: 9px; font-weight: 500;">VND</span>
        </h3>
        
        {{#if variants}}
        <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
          <thead>
            <tr style="color: #64748b; font-weight: 700; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-transform: uppercase;">
              <th style="padding: 5px 0;">Kênh</th>
              <th style="padding: 5px 0; text-align: center;">Quy cách</th>
              <th style="padding: 5px 0; text-align: right;">Giá niêm yết</th>
            </tr>
          </thead>
          <tbody>
            {{#each variants}}
            <tr style="border-top: 1px solid #f8fafc; color: #334155;">
              <td style="padding: 6px 0; font-weight: 700; text-transform: uppercase; font-size: 8.5px; color: #1e3a8a;">{{channel}}</td>
              <td style="padding: 6px 0; text-align: center; font-weight: 600;">{{size_label}}</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #0f172a; font-mono: true;">{{price}}</td>
            </tr>
            {{/each}}
          </tbody>
        </table>
        {{else}}
          <div style="font-size: 9.5px; color: #94a3b8; text-align: center; padding: 10px 0; font-style: italic;">
            Chưa có bảng giá đã duyệt.
          </div>
        {{/if}}
      </div>
    </div>

    <!-- Right Panel: AI Product Knowledge Base -->
    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 10.5px;">
      <!-- Hero Product Quote -->
      <div style="background: #eff6ff; border-left: 4px solid #1e3a8a; border-radius: 0 8px 8px 0; padding: 10px 14px; border-top: 1px solid #dbeafe; border-right: 1px solid #dbeafe; border-bottom: 1px solid #dbeafe;">
        <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #1e3a8a; font-style: italic; font-weight: 500;">
          {{product.short_description}}
        </p>
      </div>

      <!-- Core Features -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">CÔNG DỤNG NỔI BẬT</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.benefits}}</div>
      </div>

      <!-- Skin Compatibility -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">LOẠI DA PHÙ HỢP</h4>
        <div style="line-height: 1.45; color: #334155;">{{knowledge.skin_types}}</div>
      </div>

      <!-- Usage Instructions -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">HƯỚNG DẪN SỬ DỤNG</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.usage}}</div>
      </div>

      <!-- Advisory & Warnings Grid (Responsive Print Design) -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #d97706; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fde68a; padding-bottom: 2px;">LƯU Ý TƯ VẤN</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #78350f; white-space: pre-line; font-weight: 500;">{{knowledge.sales_notes}}</div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fca5a5; padding-bottom: 2px;">CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #7f1d1d; white-space: pre-line; font-weight: 500;">{{knowledge.warnings}}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer Info block -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; font-weight: 500;">
    <div>Tài liệu lưu hành nội bộ Desembre | Tạo lúc: {{generated_at}} | Ghi chú: {{footer_note}}</div>
    <div>Trang 1/1</div>
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
  const isAdminOrSub = roles.some((r) => ["admin", "sub_admin", "sub-admin"].includes(r));
  const previewFrameRef = useRef<any>(null);

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
  const [versions, setVersions] = useState<any[]>([]);

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
      // 1. Fetch available templates (approved only)
      const { data: templatesData, error: tErr } = await supabase
        .from("document_templates")
        .select("id, name, html_template, status, is_default")
        .eq("template_type", "product_sales_sheet")
        .eq("status", "approved");

      if (tErr) throw tErr;
      setTemplates(templatesData || []);

      const defaultT = templatesData?.find((t: any) => t.is_default === true) || 
                       templatesData?.find((t: any) => t.name.toLowerCase().includes("premium") || t.name.toLowerCase().includes("chuẩn a4")) ||
                       templatesData?.[0];

      // 2. Fetch all existing sales sheets for the product
      let query = supabase
        .from("product_sales_sheets")
        .select("*")
        .eq("catalog_product_id", catalogProductId);

      if (!isAdminOrSub) {
        query = query.eq("status", "approved");
      }

      const { data: sheetsData, error: sErr } = await query;

      if (sErr) throw sErr;

      let sortedVersions = [];
      let activeSheet = null;

      if (sheetsData && sheetsData.length > 0) {
        // Sort client-side for defensive schema loading (is_current first, then version desc, then created_at desc)
        sortedVersions = [...sheetsData].sort((a, b) => {
          const currentA = a.is_current === true ? 1 : 0;
          const currentB = b.is_current === true ? 1 : 0;
          if (currentA !== currentB) return currentB - currentA;

          const vA = typeof a.version === "number" ? a.version : 1;
          const vB = typeof b.version === "number" ? b.version : 1;
          if (vA !== vB) return vB - vA;

          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        // Fallback: if no sheet is marked as current, treat the first one as current
        const hasCurrent = sortedVersions.some((v) => v.is_current === true);
        if (!hasCurrent && sortedVersions[0]) {
          sortedVersions[0].is_current = true;
        }

        activeSheet = sortedVersions.find((v) => v.is_current === true) || sortedVersions[0];
      }

      setVersions(sortedVersions);

      if (activeSheet) {
        setSalesSheetId(activeSheet.id);
        setTitle(activeSheet.title);
        setStatus(activeSheet.status as any);
        setSelectedTemplateId(activeSheet.template_id || "");
        if (activeSheet.content_json) {
          setContentJson(activeSheet.content_json as any);
        }
      } else {
        // Clear state for new sheet
        setSalesSheetId(null);
        setTitle(`Sales Sheet - ${productName}`);
        setStatus("draft");
        setSelectedTemplateId(defaultT?.id || "");
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

  const handleVersionChange = (versionId: string) => {
    const found = versions.find((v) => v.id === versionId);
    if (found) {
      setSalesSheetId(found.id);
      setTitle(found.title);
      setStatus(found.status as any);
      setSelectedTemplateId(found.template_id || "");
      if (found.content_json) {
        setContentJson(found.content_json as any);
      }
    }
  };

  // Transactional RPC for setting current/default version (v1.4.1T.5)
  // Replaces client-side two-step update — now atomic via DB function
  const handleSetCurrentVersion = async (targetId: string) => {
    if (!isAdminOrSub || !targetId) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_current_product_sales_sheet", {
        p_sheet_id: targetId,
      });
      if (error) throw error;
      toast.success("Đặt phiên bản này làm mặc định thành công!");
      await loadData();
    } catch (err: any) {
      const msg = err?.message || "Lỗi không xác định";
      toast.error("Lỗi khi đặt phiên bản mặc định: " + msg);
      await loadData();
    } finally {
      setSaving(false);
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
  const handleSave = async (
    newStatus?: "draft" | "approved" | "archived",
    saveAsNewVersion: boolean = false
  ) => {
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

      const shouldCreateNew = saveAsNewVersion || !salesSheetId;

      if (!shouldCreateNew && salesSheetId) {
        // Overwrite/Update existing version
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
        toast.success(`Cập nhật phiên bản hiện tại (${targetStatus}) thành công!`);
      } else {
        // Create new version
        const nextVersionNum = versions.length > 0
          ? Math.max(...versions.map((v) => typeof v.version === "number" ? v.version : 1)) + 1
          : 1;

        const insertPayload = {
          ...payload,
          generated_by: user?.id || null,
          version: nextVersionNum,
          is_current: versions.length === 0, // Mark first version as default/current automatically
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
        toast.success(`Lưu phiên bản mới v${nextVersionNum} (${targetStatus}) thành công!`);
      }

      await loadData();
      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      const error = err as Error;
      toast.error("Lỗi khi lưu: " + error.message);
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
      if (Array.isArray(val)) return val.map((v) => `- ${v}`).join("\n");
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
      generated_at: new Date().toLocaleString("vi-VN"),
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

  const handlePricingField = (
    type: "retail" | "salon",
    index: number,
    field: string,
    value: string,
  ) => {
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

  const handleKnowledgeFieldChange = (
    field: keyof SalesSheetContent["knowledge"],
    index: number,
    value: string,
  ) => {
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

  const handleRemoveKnowledgeItem = (
    field: keyof SalesSheetContent["knowledge"],
    index: number,
  ) => {
    setContentJson((prev) => {
      const list = prev.knowledge[field].filter((_, i) => i !== index);
      return { ...prev, knowledge: { ...prev.knowledge, [field]: list } };
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
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
              {productName} &bull; Trạng thái:{" "}
              <span className={`font-bold uppercase ${!isAdminOrSub ? "text-emerald-600" : "text-indigo-600"}`}>
                {!isAdminOrSub ? "APPROVED" : status}
              </span>
            </p>
          </div>
          {isAdminOrSub && (
            <div className="flex gap-2 mr-6">
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
              {salesSheetId && (
                <>
                  <Button
                    onClick={() => handleSave(status === "approved" ? "approved" : "draft", false)}
                    disabled={saving || loading}
                    variant="outline"
                    className="font-bold border-slate-200 text-slate-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Lưu đè
                  </Button>
                  {status !== "approved" && (
                    <Button
                      onClick={() => handleSave("approved", false)}
                      disabled={saving || loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Duyệt & Lưu đè
                    </Button>
                  )}
                </>
              )}
              <Button
                onClick={() => handleSave("draft", true)}
                disabled={saving || loading}
                variant="outline"
                className="font-bold text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Lưu bản mới (Nháp)
              </Button>
              <Button
                onClick={() => handleSave("approved", true)}
                disabled={saving || loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Duyệt & Lưu bản mới
              </Button>
            </div>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-500">Đang tải dữ liệu Sales Sheet...</p>
          </div>
        ) : (
          <>
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel: Fields inputs (Only Editable by Admin/Sub-admin) */}
              {isAdminOrSub && (
                <div className="w-full md:w-1/2 border-r border-slate-200 flex flex-col overflow-y-auto bg-slate-50 p-6 space-y-6">
                  {/* Version History Selector Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                        Lịch sử phiên bản
                      </h3>
                      {versions.length > 0 && (
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-500">
                          Có {versions.length} phiên bản
                        </span>
                      )}
                    </div>
                    
                    {versions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Chưa có phiên bản nào được lưu cho sản phẩm này.</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2 items-center">
                          <select
                            value={salesSheetId || ""}
                            onChange={(e) => handleVersionChange(e.target.value)}
                            className="flex-1 h-9 border border-slate-200 rounded-md px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                          >
                            {versions.map((v) => {
                              const isCurrent = v.is_current === true;
                              const verNum = typeof v.version === "number" ? v.version : 1;
                              const formattedDate = v.created_at ? new Date(v.created_at).toLocaleDateString("vi-VN") : "";
                              const statusLabel = v.status === "approved" ? "Duyệt" : "Nháp";
                              return (
                                <option key={v.id} value={v.id}>
                                  v{verNum} ({statusLabel}) - {formattedDate} {isCurrent ? "★ Mặc định" : ""}
                                </option>
                              );
                            })}
                          </select>
                          
                          {/* Set Current Version Button */}
                          {isAdminOrSub && salesSheetId && !versions.find(v => v.id === salesSheetId)?.is_current && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetCurrentVersion(salesSheetId)}
                              className="h-9 text-xs border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold"
                              title="Đặt làm phiên bản hiện tại mặc định"
                            >
                              Đặt mặc định
                            </Button>
                          )}
                        </div>

                        {/* Active Version Info Badges */}
                        {(() => {
                          const activeV = versions.find(v => v.id === salesSheetId);
                          if (!activeV) return null;
                          return (
                            <div className="flex flex-wrap gap-2 text-[10px]">
                              <span className={`px-2 py-0.5 rounded font-bold ${activeV.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                {activeV.status === 'approved' ? 'Đã duyệt (Approved)' : 'Bản nháp (Draft)'}
                              </span>
                              {activeV.is_current && (
                                <span className="px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-0.5">
                                  ★ Phiên bản mặc định
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-600">
                                Phiên bản v{activeV.version || 1}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

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
                        <Label className="text-xs font-bold text-slate-500">
                          Chọn mẫu giao diện (Template)
                        </Label>
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
                      <Label className="text-xs font-bold text-slate-500">
                        Mô tả ngắn gọn (Short Description)
                      </Label>
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
                              onChange={(e) =>
                                handlePricingField("retail", index, "sku", e.target.value)
                              }
                              disabled={!isAdminOrSub}
                              className="h-8 text-xs border-slate-200 w-1/4"
                            />
                            <Input
                              placeholder="Dung tích (vd: 150ml)"
                              value={row.size_label}
                              onChange={(e) =>
                                handlePricingField("retail", index, "size_label", e.target.value)
                              }
                              disabled={!isAdminOrSub}
                              className="h-8 text-xs border-slate-200 w-1/3"
                            />
                            <Input
                              placeholder="Giá niêm yết (vd: 650,000đ)"
                              value={row.price}
                              onChange={(e) =>
                                handlePricingField("retail", index, "price", e.target.value)
                              }
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
                      <p className="text-xs text-slate-400 italic">
                        Chưa có thông tin giá chuyên nghiệp.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {contentJson.pricing?.salon?.map((row, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <Input
                              placeholder="SKU"
                              value={row.sku}
                              onChange={(e) =>
                                handlePricingField("salon", index, "sku", e.target.value)
                              }
                              disabled={!isAdminOrSub}
                              className="h-8 text-xs border-slate-200 w-1/4"
                            />
                            <Input
                              placeholder="Dung tích (vd: 1000ml)"
                              value={row.size_label}
                              onChange={(e) =>
                                handlePricingField("salon", index, "size_label", e.target.value)
                              }
                              disabled={!isAdminOrSub}
                              className="h-8 text-xs border-slate-200 w-1/3"
                            />
                            <Input
                              placeholder="Giá chuyên nghiệp (vd: 1,650,000đ)"
                              value={row.price}
                              onChange={(e) =>
                                handlePricingField("salon", index, "price", e.target.value)
                              }
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
                  {(
                    [
                      { key: "benefits", label: "Công dụng chính (Benefits)" },
                      { key: "skin_types", label: "Loại da phù hợp" },
                      { key: "usage", label: "Hướng dẫn sử dụng (Usage)" },
                      { key: "sales_notes", label: "Lưu ý tư vấn bán hàng" },
                      { key: "warnings", label: "Cảnh báo / Chống chỉ định" },
                    ] as const
                  ).map(({ key, label }) => (
                    <div
                      key={key}
                      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm"
                    >
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
                      {!contentJson.knowledge?.[key] || contentJson.knowledge?.[key]?.length === 0 ? (
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
                        onChange={(e) =>
                          setContentJson((prev) => ({ ...prev, footer_note: e.target.value }))
                        }
                        disabled={!isAdminOrSub}
                        placeholder="Nhập ghi chú chân trang..."
                        className="border-slate-200 text-slate-800 min-h-[60px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Right Panel: Live A4 Preview */}
              <div className={`bg-slate-100 relative flex flex-col overflow-hidden ${!isAdminOrSub ? "w-full flex-1" : "w-1/2 hidden md:block"}`}>
                {salesSheetId ? (
                  <A4PreviewFrame
                    ref={previewFrameRef}
                    htmlContent={previewHtml}
                    title={title}
                    hidePrintButton={!isAdminOrSub}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
                    <FileText className="w-16 h-16 text-slate-300 mb-4" />
                    <p className="text-sm font-bold text-slate-500">Chưa có tài liệu đã duyệt.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons for Sale/Telesales */}
            {!isAdminOrSub && (
              <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                {salesSheetId && (
                  <Button
                    onClick={() => previewFrameRef.current?.print()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    In / Xuất PDF
                  </Button>
                )}
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="font-bold border-slate-200 text-slate-700"
                >
                  Đóng
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
