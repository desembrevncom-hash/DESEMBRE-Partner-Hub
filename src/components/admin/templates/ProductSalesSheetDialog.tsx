/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  FileDown,
  Save,
  CheckCircle,
  FileText,
  Plus,
  Trash,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { A4PreviewFrame } from "./A4PreviewFrame";
import { renderTemplate } from "@/lib/documentTemplates";
import {
  sortSalesSheetVersions,
  isVersionDefault,
  findLatestApprovedVersion,
  resolveActiveSalesSheet,
  formatSalesSheetOptionLabel,
  normalizeSalesSheetContent,
  dedupeSalesSheetIngredients,
  cleanSalesSheetTemplateHtml,
  generateSalesSheetFileName,
  isTemplateV2,
} from "@/lib/salesSheetVersionUtils";
import {
  exportProductSalesSheetPdf,
  type ProductSalesSheetPdfData,
} from "@/lib/salesSheetPdfExport";

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
  initialAudience?: "customer" | "internal";
}

const DEFAULT_HTML_TEMPLATE = `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; color: #1e293b; line-height: 1.4; padding: 5px;">
  <!-- Premium Header -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px;">
    <div>
      <span style="font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.15em; background: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe;">THÔNG TIN SẢN PHẨM</span>
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
          <span>BẢNG GIÁ SẢN PHẨM</span>
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

      <!-- Key Ingredients & Functions (Canonical) -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.key_ingredients}}</div>
      </div>

      {{#if knowledge.show_ingredient_highlights}}
      <!-- Ingredient Highlights (Only shown if key ingredients & functions is missing) -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN NỔI BẬT</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.ingredient_highlights}}</div>
      </div>
      {{/if}}

      <!-- Full Ingredients -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN ĐẦY ĐỦ</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line; font-size: 9px;">{{knowledge.full_ingredients}}</div>
      </div>

      <!-- Skin Compatibility -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">LOẠI DA PHÙ HỢP</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.skin_types}}</div>
      </div>

      <!-- Usage Instructions -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">HƯỚNG DẪN SỬ DỤNG</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.usage}}</div>
      </div>

      <!-- Advisory & Warnings -->
      {{#if knowledge.sales_notes}}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #d97706; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fde68a; padding-bottom: 2px;">LƯU Ý TƯ VẤN</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #78350f; white-space: pre-line; font-weight: 500;">{{knowledge.sales_notes}}</div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fca5a5; padding-bottom: 2px;">CẢNH BÁO / CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #7f1d1d; white-space: pre-line; font-weight: 500;">{{knowledge.warnings}}</div>
        </div>
      </div>
      {{else}}
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fca5a5; padding-bottom: 2px;">CẢNH BÁO / CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #7f1d1d; white-space: pre-line; font-weight: 500;">{{knowledge.warnings}}</div>
        </div>
      </div>
      {{/if}}
    </div>
  </div>

  <!-- Footer Info block -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; font-weight: 500;">
    <div>{{footer_note}} | Tạo lúc: {{generated_at}}</div>
    <div>Trang 1/1</div>
  </div>
</div>
`;

const DEFAULT_HTML_TEMPLATE_V2 = DEFAULT_HTML_TEMPLATE.replace(
  /\s*<div style="text-align: right;">[\s\S]*?Luxury Cosmetics<\/div>\s*<\/div>/,
  "",
);

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
    ingredient_highlights?: string[];
    full_ingredients?: string;
    key_ingredients?: string[];
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
  initialAudience = "customer",
}: ProductSalesSheetDialogProps) {
  const { user, roles } = useAuth();
  const isAdminOrSub = roles.some((r) => ["admin", "sub_admin", "sub-admin"].includes(r));
  const previewFrameRef = useRef<any>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [audience, setAudience] = useState<"customer" | "internal">(initialAudience);

  // Verification Gate States (Guidebook & Approved Knowledge)
  const [guidebookStatus, setGuidebookStatus] = useState<"none" | "saved" | "extracted">("none");
  const [knowledgeApproved, setKnowledgeApproved] = useState<boolean>(false);

  const canGenerateAI = guidebookStatus === "extracted" && knowledgeApproved;
  const blockReason = useMemo(() => {
    if (guidebookStatus === "none") return "Chưa có Guidebook";
    if (guidebookStatus === "saved") return "Guidebook chưa trích xuất";
    if (!knowledgeApproved) return "Tri thức AI chưa duyệt";
    return "";
  }, [guidebookStatus, knowledgeApproved]);

  // Sales Sheet record states
  const [salesSheetId, setSalesSheetId] = useState<string | null>(null);
  const [title, setTitle] = useState(`Sales Sheet - ${productName}`);
  const [status, setStatus] = useState<"draft" | "approved" | "archived">("draft");
  const [isPublic, setIsPublic] = useState(false);
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
    footer_note: "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.",
  });

  // Load Templates & Existing Sheet Data
  useEffect(() => {
    if (isOpen && catalogProductId) {
      if (initialAudience) {
        setAudience(initialAudience);
      }
      loadData();
    }
  }, [isOpen, catalogProductId, initialAudience]);

  const loadData = async (targetSelectedId?: string) => {
    setLoading(true);
    try {
      // 1. Fetch available templates (approved only)
      const { data: templatesData, error: tErr } = await supabase
        .from("document_templates")
        .select("id, name, html_template, status, is_default")
        .eq("template_type", "product_sales_sheet")
        .eq("status", "approved");

      if (tErr) throw tErr;

      const fetched = (templatesData || []) as any[];
      const mergedTemplates = [...fetched];

      if (!mergedTemplates.some((t) => t.name === "product_sales_sheet_premium_v1")) {
        mergedTemplates.unshift({
          id: "d1a22222-2222-2222-2222-222222222222",
          name: "product_sales_sheet_premium_v1",
          html_template: DEFAULT_HTML_TEMPLATE,
          status: "approved",
          is_default: true,
        });
      }

      if (!mergedTemplates.some((t) => t.name === "product_sales_sheet_premium_v2")) {
        mergedTemplates.push({
          id: "d1a22222-2222-2222-2222-222222222223",
          name: "product_sales_sheet_premium_v2",
          html_template: DEFAULT_HTML_TEMPLATE_V2,
          status: "approved",
          is_default: false,
        });
      }

      setTemplates(mergedTemplates);

      const defaultT =
        mergedTemplates.find((t: any) => t.is_default === true) ||
        mergedTemplates.find(
          (t: any) =>
            t.name.toLowerCase().includes("premium") || t.name.toLowerCase().includes("chuẩn a4"),
        ) ||
        mergedTemplates[0];

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

      const rawSheets = (sheetsData || []) as any[];
      const sortedVersions = sortSalesSheetVersions(rawSheets);
      setVersions(sortedVersions);

      // Determine active sheet:
      // Priority: targetSelectedId -> Approved Default -> Any Default -> Latest Approved -> Newest
      const activeSheet = resolveActiveSalesSheet(sortedVersions, {
        targetSelectedId: targetSelectedId || salesSheetId || undefined,
      });

      if (activeSheet) {
        setSalesSheetId(activeSheet.id);
        setTitle(activeSheet.title);
        setStatus(activeSheet.status as any);
        setIsPublic(activeSheet.is_public ?? false);
        setSelectedTemplateId(activeSheet.template_id || "");
        setContentJson(
          normalizeSalesSheetContent(activeSheet.content_json, productName, categoryName),
        );
      } else {
        // Clear state for new sheet
        setSalesSheetId(null);
        setTitle(`Sales Sheet - ${productName}`);
        setStatus("draft");
        setIsPublic(false);
        setSelectedTemplateId(defaultT?.id || "");
        setContentJson(normalizeSalesSheetContent({}, productName, categoryName));
      }

      // 3. Fetch Guidebook & Knowledge verification gates
      const { data: sourceDocs } = await supabase
        .from("product_source_documents")
        .select("id, extraction_status")
        .eq("catalog_product_id", catalogProductId);

      let gStatus: "none" | "saved" | "extracted" = "none";
      if (sourceDocs && sourceDocs.length > 0) {
        if (sourceDocs.some((d: any) => d.extraction_status === "completed")) {
          gStatus = "extracted";
        } else {
          gStatus = "saved";
        }
      }
      setGuidebookStatus(gStatus);

      let kApproved = false;
      const { data: knowledgeRow } = await supabase
        .from("product_knowledge")
        .select("id, qa_status, is_active")
        .eq("catalog_product_id", catalogProductId)
        .maybeSingle();

      if (knowledgeRow && knowledgeRow.qa_status === "approved" && knowledgeRow.is_active) {
        kApproved = true;
      } else if (productCode && !isNaN(Number(productCode))) {
        const { data: legacyRow } = await supabase
          .from("product_knowledge")
          .select("id, qa_status, is_active")
          .eq("product_id", Number(productCode))
          .maybeSingle();
        if (legacyRow && legacyRow.qa_status === "approved" && legacyRow.is_active) {
          kApproved = true;
        }
      }
      setKnowledgeApproved(kApproved);
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
      setIsPublic(found.is_public ?? false);
      setSelectedTemplateId(found.template_id || "");
      setContentJson(normalizeSalesSheetContent(found.content_json, productName, categoryName));
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
      await loadData(targetId);
      if (onSaved) {
        onSaved();
      }
    } catch (err: any) {
      const msg = err?.message || "Lỗi không xác định";
      toast.error("Lỗi khi đặt phiên bản mặc định: " + msg);
      await loadData(targetId);
    } finally {
      setSaving(false);
    }
  };

  // Generate via AI Edge Function
  const handleGenerateAI = async () => {
    if (!isAdminOrSub) return;
    if (!canGenerateAI) {
      toast.error(blockReason || "Không đủ điều kiện để tạo Sales Sheet bằng AI.");
      return;
    }
    if (!catalogProductId) {
      toast.error("Thiếu mã định danh sản phẩm (catalogProductId).");
      return;
    }

    setGenerating(true);
    try {
      const payload = {
        catalogProductId,
        templateId: selectedTemplateId || null,
        productName,
        brandId,
        categoryName,
        productCode,
      };

      const { data, error } = await supabase.functions.invoke("generate-product-sales-sheet", {
        body: payload,
      });

      if (error) {
        let serverErrorMsg = "";
        let responseBody: any = null;

        if (
          "context" in error &&
          error.context &&
          typeof (error.context as any).json === "function"
        ) {
          try {
            responseBody = await (error.context as any).json();
            serverErrorMsg = responseBody?.error || responseBody?.message;
          } catch {
            // Ignore JSON parse error from error context
          }
        }

        if (import.meta.env.DEV) {
          console.error("[generate-product-sales-sheet] Error details:", {
            operation: "handleGenerateAI",
            functionName: "generate-product-sales-sheet",
            productId: catalogProductId,
            status: (error as any)?.status,
            responseBody: responseBody || data,
            invokeError: error,
          });
        }

        if (serverErrorMsg) {
          throw new Error(serverErrorMsg);
        }

        if (error.message?.includes("Failed to send a request to the Edge Function")) {
          throw new Error(
            "Không thể kết nối đến Edge Function. Vui lòng kiểm tra lại dịch vụ Edge Function hoặc kết nối mạng.",
          );
        }

        throw error;
      }

      if (!data || !data.success) {
        const errorMsg = data?.error || "AI generation returned success=false";
        if (import.meta.env.DEV) {
          console.error("[generate-product-sales-sheet] Unsuccessful response:", {
            operation: "handleGenerateAI",
            functionName: "generate-product-sales-sheet",
            productId: catalogProductId,
            responseBody: data,
          });
        }
        throw new Error(errorMsg);
      }

      setTitle(data.title || `Sales Sheet - ${productName}`);
      if (data.content_json) {
        setContentJson(data.content_json);
      }
      toast.success("Sinh dữ liệu Sales Sheet thành công!");
    } catch (e: any) {
      if (import.meta.env.DEV) {
        console.error("[generate-product-sales-sheet] Catch handler:", e);
      }
      toast.error("Lỗi sinh AI: " + (e?.message || "Lỗi không xác định"));
    } finally {
      setGenerating(false);
    }
  };

  // Save changes
  const handleSave = async (
    newStatus?: "draft" | "approved" | "archived",
    saveAsNewVersion: boolean = false,
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
        is_public: isPublic,
      };

      const shouldCreateNew = saveAsNewVersion || !salesSheetId;

      if (!shouldCreateNew && salesSheetId) {
        // Overwrite/Update existing version
        const updatePayload: any = {
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

        // If approved, promote it to current/default
        if (targetStatus === "approved") {
          try {
            await supabase.rpc("set_current_product_sales_sheet", {
              p_sheet_id: salesSheetId,
            });
          } catch (promoteErr) {
            console.warn("RPC set_current_product_sales_sheet notice:", promoteErr);
          }
        }

        toast.success(`Cập nhật phiên bản hiện tại (${targetStatus}) thành công!`);
        await loadData(salesSheetId);
      } else {
        // Create new version
        const nextVersionNum =
          versions.length > 0
            ? Math.max(...versions.map((v) => (typeof v.version === "number" ? v.version : 1)), 0) +
              1
            : 1;

        const insertPayload: any = {
          ...payload,
          generated_by: user?.id || null,
          version: nextVersionNum,
          is_current: false,
          is_default: false,
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

        // When approved, promote new version to current/default automatically
        if (targetStatus === "approved") {
          try {
            const { error: rpcErr } = await supabase.rpc("set_current_product_sales_sheet", {
              p_sheet_id: data.id,
            });
            if (rpcErr) {
              console.warn("Failed to set newly approved version as current via RPC:", rpcErr);
            }
          } catch (promoteErr) {
            console.warn("Error setting default sales sheet version:", promoteErr);
          }
        }

        setSalesSheetId(data.id);
        toast.success(`Lưu phiên bản mới v${nextVersionNum} (${targetStatus}) thành công!`);
        await loadData(data.id);
      }

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

  // Direct PDF export and download without browser print dialog
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const dedupedIngredients = dedupeSalesSheetIngredients(contentJson.knowledge || {});
      const retailList = contentJson.pricing?.retail || [];
      const salonList = contentJson.pricing?.salon || [];
      const formattedVariants = [
        ...retailList.map((v) => ({ ...v, channel: "retail" })),
        ...salonList.map((v) => ({ ...v, channel: "salon" })),
      ];

      const activeTemplate = templates.find((t) => t.id === selectedTemplateId);
      const hideBrandLogo = isTemplateV2(
        activeTemplate?.name,
        activeTemplate?.html_template || activeTemplateHtml,
      );

      const pdfData: ProductSalesSheetPdfData = {
        product: {
          name: contentJson.product?.name || productName,
          brand_name: contentJson.product?.brand_name || "Desembre",
          category_name: contentJson.product?.category_name || categoryName,
          short_description: contentJson.product?.short_description || "",
          image_url: imageUrl || "",
        },
        variants: formattedVariants,
        knowledge: {
          benefits: contentJson.knowledge?.benefits || [],
          key_ingredients: dedupedIngredients.has_key_ingredients
            ? dedupedIngredients.key_ingredients
            : (contentJson.knowledge as any)?.key_ingredients || [],
          ingredient_highlights: dedupedIngredients.ingredient_highlights,
          show_ingredient_highlights: dedupedIngredients.show_ingredient_highlights,
          full_ingredients: dedupedIngredients.full_ingredients,
          skin_types: contentJson.knowledge?.skin_types || [],
          usage: contentJson.knowledge?.usage || [],
          warnings: contentJson.knowledge?.warnings || [],
          sales_notes: audience === "customer" ? [] : contentJson.knowledge?.sales_notes || [],
        },
        footer_note:
          contentJson.footer_note || "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.",
        generated_at: new Date().toLocaleString("vi-VN"),
        audience,
        hideBrandLogo,
      };

      const fileName = generateSalesSheetFileName(contentJson.product?.name || productName);
      await exportProductSalesSheetPdf(pdfData, fileName);
      toast.success("Đã xuất file PDF thành công!");
    } catch (err: any) {
      console.error("[ProductSalesSheetDialog] PDF export error:", err);
      toast.error("Lỗi xuất PDF: " + (err?.message || "Không thể xuất file"));
    } finally {
      setIsExporting(false);
    }
  };

  // Render variables for A4 Preview Frame
  const activeTemplateHtml = useMemo(() => {
    const matched = templates.find((t) => t.id === selectedTemplateId);
    const html = matched?.html_template || DEFAULT_HTML_TEMPLATE;
    console.log("[SalesSheetTemplate]", {
      selectedTemplateName: matched?.name,
      selectedTemplateId,
      htmlLength: html.length,
      hasLuxuryCosmetics: html.includes("Luxury Cosmetics"),
      hasBenefits: html.includes("knowledge.benefits"),
      hasKeyIngredients: html.includes("knowledge.key_ingredients"),
      hasFullIngredients: html.includes("knowledge.full_ingredients"),
      hasUsage: html.includes("knowledge.usage"),
    });
    return html;
  }, [templates, selectedTemplateId]);


  const previewHtml = useMemo(() => {
    // Adapter to transform content_json structure into matching formats expected by the template
    const joinList = (val: any) => {
      if (Array.isArray(val)) {
        const valid = val.filter((v) => typeof v === "string" && v.trim() !== "");
        if (valid.length === 0) return "Chưa có thông tin trong tài liệu nguồn.";
        return valid.map((v) => `- ${v}`).join("\n");
      }
      if (typeof val === "string" && val.trim() !== "") return val;
      return "Chưa có thông tin trong tài liệu nguồn.";
    };

    const retailList = contentJson.pricing?.retail || [];
    const salonList = contentJson.pricing?.salon || [];

    const formattedVariants = [
      ...retailList.map((v) => ({ ...v, channel: "retail" })),
      ...salonList.map((v) => ({ ...v, channel: "salon" })),
    ];

    // Dedupe & normalize ingredients according to canonical hierarchy
    const dedupedIngredients = dedupeSalesSheetIngredients(contentJson.knowledge || {});

    // Clean template if key_ingredients exists to ensure no static "THÀNH PHẦN NỔI BẬT" remains, and clean internal elements if customer mode
    const templateToUse = cleanSalesSheetTemplateHtml(
      activeTemplateHtml,
      dedupedIngredients.has_key_ingredients,
      audience,
    );

    const dataForRendering = {
      product: {
        name: contentJson.product?.name || productName,
        brand_name: contentJson.product?.brand_name || "",
        category_name: contentJson.product?.category_name || categoryName,
        short_description:
          contentJson.product?.short_description || "Chưa có thông tin trong tài liệu nguồn.",
        image_url: imageUrl || "",
        product_code: productCode || "",
      },
      pricing: contentJson.pricing || { retail: [], salon: [] },
      variants: formattedVariants,
      knowledge: {
        benefits: joinList(contentJson.knowledge?.benefits),
        ingredient_highlights: dedupedIngredients.show_ingredient_highlights
          ? joinList(dedupedIngredients.ingredient_highlights)
          : "",
        show_ingredient_highlights: dedupedIngredients.show_ingredient_highlights,
        full_ingredients:
          dedupedIngredients.full_ingredients !== ""
            ? dedupedIngredients.full_ingredients
            : "Chưa có thông tin trong tài liệu nguồn.",
        key_ingredients: joinList(
          dedupedIngredients.has_key_ingredients
            ? dedupedIngredients.key_ingredients
            : (contentJson.knowledge as any)?.key_ingredients,
        ),
        skin_types: joinList(contentJson.knowledge?.skin_types),
        usage: joinList(contentJson.knowledge?.usage),
        sales_notes: audience === "customer" ? "" : joinList(contentJson.knowledge?.sales_notes),
        warnings: joinList(contentJson.knowledge?.warnings),
      },
      footer_note:
        contentJson.footer_note || "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.",
      generated_at: new Date().toLocaleString("vi-VN"),
    };

    return renderTemplate(templateToUse, dataForRendering);
  }, [contentJson, activeTemplateHtml, productName, categoryName, imageUrl, productCode, audience]);

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
      const current = prev.knowledge[field];
      const list = Array.isArray(current) ? [...current] : [];
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
      const current = prev.knowledge[field];
      const list = Array.isArray(current) ? [...current] : [];
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
      const current = prev.knowledge[field];
      const list = Array.isArray(current) ? current.filter((_, i) => i !== index) : [];
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
              <span
                className={`font-bold uppercase ${!isAdminOrSub ? "text-emerald-600" : "text-indigo-600"}`}
              >
                {!isAdminOrSub ? "APPROVED" : status}
              </span>
            </p>
          </div>
          {isAdminOrSub && (
            <div className="flex items-center gap-2 mr-6">
              {!canGenerateAI && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold"
                  title="Cần có Guidebook đã trích xuất và Tri thức AI đã duyệt để tạo Sales Sheet bằng AI"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{blockReason}</span>
                </div>
              )}
              <Button
                onClick={handleGenerateAI}
                disabled={generating || loading || !canGenerateAI}
                variant="outline"
                className={`font-bold transition-all ${
                  canGenerateAI
                    ? "border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                    : "border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed opacity-60"
                }`}
                title={!canGenerateAI ? blockReason : "Tạo bằng AI (OpenAI)"}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang sinh AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 text-indigo-600" />
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
              {salesSheetId && (
                <Button
                  onClick={handleExportPdf}
                  disabled={isExporting || loading}
                  variant="outline"
                  aria-label="Xuất tài liệu PDF"
                  title="Xuất tài liệu PDF"
                  className="font-bold border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                >
                  <FileDown className="w-4 h-4 mr-1.5" />
                  {isExporting ? "Đang xuất..." : "XUẤT PDF"}
                </Button>
              )}
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
                      <p className="text-xs text-slate-400 italic">
                        Chưa có phiên bản nào được lưu cho sản phẩm này.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2 items-center">
                          <select
                            value={salesSheetId || ""}
                            onChange={(e) => handleVersionChange(e.target.value)}
                            className="flex-1 h-9 border border-slate-200 rounded-md px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                          >
                            {(() => {
                              const latestApproved = findLatestApprovedVersion(versions);
                              return versions.map((v) => {
                                const label = formatSalesSheetOptionLabel(v, latestApproved?.id);
                                return (
                                  <option key={v.id} value={v.id}>
                                    {label}
                                  </option>
                                );
                              });
                            })()}
                          </select>

                          {/* Set Current Version Button */}
                          {isAdminOrSub &&
                            salesSheetId &&
                            (() => {
                              const activeV = versions.find((v) => v.id === salesSheetId);
                              const isCur = activeV ? isVersionDefault(activeV) : false;
                              if (isCur || activeV?.status !== "approved") return null;
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSetCurrentVersion(salesSheetId)}
                                  className="h-9 text-xs border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold"
                                  title="Đặt phiên bản này làm mặc định"
                                >
                                  Đặt mặc định
                                </Button>
                              );
                            })()}
                        </div>

                        {/* Active Version Info Badges */}
                        {(() => {
                          const activeV = versions.find((v) => v.id === salesSheetId);
                          if (!activeV) return null;
                          const isCur = isVersionDefault(activeV);
                          const latestApproved = findLatestApprovedVersion(versions);
                          const isLatestApproved = !isCur && latestApproved?.id === activeV.id;

                          return (
                            <div className="flex flex-wrap gap-2 text-[10px]">
                              <span
                                className={`px-2 py-0.5 rounded font-bold ${activeV.status === "approved" ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}
                              >
                                {activeV.status === "approved"
                                  ? "Đã duyệt (Approved)"
                                  : "Bản nháp (Draft)"}
                              </span>
                              {isCur && (
                                <span className="px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-0.5">
                                  ★ Phiên bản mặc định
                                </span>
                              )}
                              {isLatestApproved && (
                                <span className="px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                                  ✦ Phiên bản duyệt mới nhất
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
                        <Label className="text-xs font-bold text-slate-500">
                          Tiêu đề Sales Sheet
                        </Label>
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
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold text-slate-700">
                          Cho phép chia sẻ công khai
                        </Label>
                        <p className="text-[11px] text-slate-500">
                          {isPublic
                            ? "Tài liệu này được phép chia sẻ công khai ra bên ngoài khi đã duyệt."
                            : "Chỉ lưu hành nội bộ, yêu cầu đăng nhập hệ thống để xem."}
                        </p>
                      </div>
                      <Switch
                        checked={isPublic}
                        onCheckedChange={setIsPublic}
                        disabled={!isAdminOrSub}
                      />
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
                      <p className="text-xs text-slate-400 italic">Chưa có thông tin giá Salon.</p>
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
                              placeholder="Giá Salon (vd: 1,650,000đ)"
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
                      { key: "key_ingredients", label: "Thành phần chính & chức năng (Canonical)" },
                      {
                        key: "ingredient_highlights",
                        label: "Thành phần nổi bật (Tags ngắn / Dự phòng)",
                      },
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
                      {!contentJson.knowledge?.[key] ||
                      contentJson.knowledge?.[key]?.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Chưa có dữ liệu.</p>
                      ) : (
                        <div className="space-y-2">
                          {contentJson.knowledge?.[key]?.map((item, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <Input
                                value={item}
                                onChange={(e) =>
                                  handleKnowledgeFieldChange(key, index, e.target.value)
                                }
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

                  {/* Full Ingredients Textarea */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                        Bảng thành phần đầy đủ (Full Ingredients)
                      </h3>
                    </div>
                    <Textarea
                      value={contentJson.knowledge?.full_ingredients || ""}
                      onChange={(e) =>
                        setContentJson((prev) => ({
                          ...prev,
                          knowledge: {
                            ...prev.knowledge,
                            full_ingredients: e.target.value,
                          },
                        }))
                      }
                      disabled={!isAdminOrSub}
                      placeholder="Danh sách toàn bộ thành phần..."
                      className="border-slate-200 text-slate-800 min-h-[70px] text-xs"
                    />
                  </div>

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
              <div
                className={`bg-slate-100 relative flex flex-col overflow-hidden ${!isAdminOrSub ? "w-full flex-1" : "w-1/2 hidden md:block"}`}
              >
                {/* Audience Switcher Toolbar */}
                <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Chế độ hiển thị:</span>
                    <div className="inline-flex rounded-md shadow-sm border border-slate-200 p-0.5 bg-slate-100">
                      <button
                        type="button"
                        onClick={() => setAudience("customer")}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                          audience === "customer"
                            ? "bg-white text-indigo-700 shadow-sm font-semibold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Khách hàng
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudience("internal")}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                          audience === "internal"
                            ? "bg-white text-indigo-700 shadow-sm font-semibold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Nội bộ
                      </button>
                    </div>
                  </div>
                  {audience === "customer" ? (
                    <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Đã lọc bỏ lưu ý &amp; kịch bản nội bộ
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Hiển thị toàn bộ lưu ý tư vấn
                    </span>
                  )}
                </div>

                {salesSheetId ? (
                  <A4PreviewFrame
                    key={`${salesSheetId}-${audience}`}
                    ref={previewFrameRef}
                    htmlContent={previewHtml}
                    title={title}
                    hideExportButton={!isAdminOrSub}
                    onExportPdf={handleExportPdf}
                    isExporting={isExporting}
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
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    aria-label="Xuất tài liệu PDF"
                    title="Xuất tài liệu PDF"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    {isExporting ? "Đang xuất PDF..." : "XUẤT PDF"}
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
