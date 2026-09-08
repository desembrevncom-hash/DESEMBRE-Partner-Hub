export interface SalesSheetVersionItem {
  id: string;
  catalog_product_id?: string;
  brand_id?: string | null;
  template_id?: string | null;
  title?: string;
  content_json?: unknown;
  status: "draft" | "approved" | "archived" | string;
  is_current?: boolean | null;
  is_default?: boolean | null;
  version?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  is_public?: boolean | null;
}

export interface NormalizedSalesSheetContent {
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

/**
 * Sorts versions newest first: highest version number first, then latest created_at.
 */
export function sortSalesSheetVersions<T extends SalesSheetVersionItem>(versions: T[]): T[] {
  return [...versions].sort((a, b) => {
    const vA = typeof a.version === "number" ? a.version : 1;
    const vB = typeof b.version === "number" ? b.version : 1;
    if (vA !== vB) return vB - vA;

    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
}

/**
 * Checks if a version row is marked as default/current.
 */
export function isVersionDefault(item: SalesSheetVersionItem): boolean {
  return item.is_default === true || item.is_current === true;
}

/**
 * Finds the latest approved version item ID from a list.
 */
export function findLatestApprovedVersion<T extends SalesSheetVersionItem>(
  versions: T[],
): T | undefined {
  const sorted = sortSalesSheetVersions(versions);
  return sorted.find((v) => v.status === "approved");
}

/**
 * Resolves the active sheet for the editor dialog:
 * 1. If targetSelectedId is supplied and exists, use it.
 * 2. If an approved default exists, use it.
 * 3. If any default exists, use it.
 * 4. Fallback to the latest approved version.
 * 5. Fallback to the newest version overall.
 */
export function resolveActiveSalesSheet<T extends SalesSheetVersionItem>(
  versions: T[],
  options?: {
    targetSelectedId?: string | null;
  },
): T | undefined {
  if (!versions || versions.length === 0) return undefined;
  const sorted = sortSalesSheetVersions(versions);

  // 1. Target ID match
  if (options?.targetSelectedId) {
    const target = sorted.find((v) => v.id === options.targetSelectedId);
    if (target) return target;
  }

  // 2. Approved default
  const approvedDefault = sorted.find((v) => isVersionDefault(v) && v.status === "approved");
  if (approvedDefault) return approvedDefault;

  // 3. Any default
  const anyDefault = sorted.find((v) => isVersionDefault(v));
  if (anyDefault) return anyDefault;

  // 4. Latest approved
  const latestApproved = sorted.find((v) => v.status === "approved");
  if (latestApproved) return latestApproved;

  // 5. Fallback to newest version
  return sorted[0];
}

/**
 * Resolves the sales sheet to be displayed in catalog / sales view.
 * If user is Sales (not manager): ONLY approved sheets are considered. Never drafts.
 * Priority: Approved Default > Latest Approved > null.
 * If user is Manager:
 * Priority: Approved Default > Any Default > Latest Approved > Newest > null.
 */
export function resolveSalesDisplaySheet<T extends SalesSheetVersionItem>(
  versions: T[],
  isManager: boolean = false,
): T | undefined {
  if (!versions || versions.length === 0) return undefined;
  const sorted = sortSalesSheetVersions(versions);

  if (!isManager) {
    const approvedOnly = sorted.filter((v) => v.status === "approved");
    if (approvedOnly.length === 0) return undefined;

    // 1. Approved Default
    const def = approvedOnly.find((v) => isVersionDefault(v));
    if (def) return def;

    // 2. Fallback to latest approved
    return approvedOnly[0];
  }

  // Manager:
  const approvedDefault = sorted.find((v) => isVersionDefault(v) && v.status === "approved");
  if (approvedDefault) return approvedDefault;

  const anyDefault = sorted.find((v) => isVersionDefault(v));
  if (anyDefault) return anyDefault;

  const latestApproved = sorted.find((v) => v.status === "approved");
  if (latestApproved) return latestApproved;

  return sorted[0];
}

/**
 * Formats the dropdown label for a version.
 * e.g. "v3 (Duyệt) - 08/09/2026 ★ Mặc định"
 *      "v2 (Nháp) - 07/09/2026"
 *      "v1 (Duyệt) - 06/09/2026 ✦ Mới nhất"
 */
export function formatSalesSheetOptionLabel(
  version: SalesSheetVersionItem,
  latestApprovedId?: string,
): string {
  const verNum = typeof version.version === "number" ? version.version : 1;
  const statusLabel = version.status === "approved" ? "Duyệt" : "Nháp";
  const formattedDate = version.created_at
    ? new Date(version.created_at).toLocaleDateString("vi-VN")
    : "";

  const isDefault = isVersionDefault(version);
  const isLatestApproved = !isDefault && latestApprovedId && version.id === latestApprovedId;

  let badge = "";
  if (isDefault) {
    badge = " ★ Mặc định";
  } else if (isLatestApproved) {
    badge = " ✦ Mới nhất";
  }

  return `v${verNum} (${statusLabel}) - ${formattedDate}${badge}`;
}

/**
 * Normalizes content_json so that no fields are undefined or malformed.
 */
export function normalizeSalesSheetContent(
  raw: unknown,
  defaultProductName: string = "",
  defaultCategoryName: string = "",
): NormalizedSalesSheetContent {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  const parsedObj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const prod = (
    parsedObj.product && typeof parsedObj.product === "object" ? parsedObj.product : {}
  ) as Record<string, unknown>;
  const pricing = (
    parsedObj.pricing && typeof parsedObj.pricing === "object" ? parsedObj.pricing : {}
  ) as Record<string, unknown>;
  const knowledge = (
    parsedObj.knowledge && typeof parsedObj.knowledge === "object" ? parsedObj.knowledge : {}
  ) as Record<string, unknown>;

  return {
    product: {
      name: typeof prod.name === "string" && prod.name ? prod.name : defaultProductName,
      brand_name: typeof prod.brand_name === "string" ? prod.brand_name : "",
      category_name:
        typeof prod.category_name === "string" && prod.category_name
          ? prod.category_name
          : defaultCategoryName,
      short_description: typeof prod.short_description === "string" ? prod.short_description : "",
    },
    pricing: {
      retail: Array.isArray(pricing.retail)
        ? (pricing.retail as Array<{ sku: string; size_label: string; price: string }>)
        : [],
      salon: Array.isArray(pricing.salon)
        ? (pricing.salon as Array<{ sku: string; size_label: string; price: string }>)
        : [],
    },
    knowledge: {
      benefits: Array.isArray(knowledge.benefits) ? (knowledge.benefits as string[]) : [],
      ingredient_highlights: Array.isArray(knowledge.ingredient_highlights)
        ? (knowledge.ingredient_highlights as string[])
        : [],
      full_ingredients:
        typeof knowledge.full_ingredients === "string" ? knowledge.full_ingredients : "",
      key_ingredients: Array.isArray(knowledge.key_ingredients)
        ? (knowledge.key_ingredients as string[])
        : [],
      skin_types: Array.isArray(knowledge.skin_types) ? (knowledge.skin_types as string[]) : [],
      usage: Array.isArray(knowledge.usage) ? (knowledge.usage as string[]) : [],
      sales_notes: Array.isArray(knowledge.sales_notes) ? (knowledge.sales_notes as string[]) : [],
      warnings: Array.isArray(knowledge.warnings) ? (knowledge.warnings as string[]) : [],
    },
    footer_note:
      typeof parsedObj.footer_note === "string" &&
      !parsedObj.footer_note.includes("Tài liệu lưu hành nội bộ")
        ? parsedObj.footer_note
        : "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.",
  };
}

export interface DedupeIngredientsResult {
  key_ingredients: string[];
  ingredient_highlights: string[];
  full_ingredients: string;
  has_key_ingredients: boolean;
  show_ingredient_highlights: boolean;
}

/**
 * Extracts a normalized ingredient name from a text bullet (e.g. "Glycerin: Giữ ẩm" -> "glycerin").
 */
export function extractIngredientName(item: string): string {
  if (!item || typeof item !== "string") return "";
  const colonIndex = item.indexOf(":");
  const namePart = colonIndex !== -1 ? item.slice(0, colonIndex) : item;
  return namePart
    .replace(/^[-*•\d.]+\s*/, "")
    .replace(/^\*+|\*+$/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Normalizer & Dedupe Guard for Sales Sheet Ingredients:
 * 1. key_ingredients (or key_ingredients_functions) is the CANONICAL field for "THÀNH PHẦN CHÍNH & CHỨC NĂNG".
 *    Format: "Tên thành phần: Chức năng/Lợi ích"
 * 2. full_ingredients is the CANONICAL field for "THÀNH PHẦN ĐẦY ĐỦ".
 * 3. ingredient_highlights is ONLY short ingredient names/tags. Never detailed bullets.
 * 4. If key_ingredients exists and has items:
 *    - "THÀNH PHẦN NỔI BẬT" is removed / not rendered (show_ingredient_highlights = false).
 * 5. If ingredient_highlights and key_ingredients contain the same ingredient names,
 *    only key_ingredients is rendered.
 * 6. Fallback between ingredient_highlights and key_ingredients is removed to prevent duplication.
 */
export function dedupeSalesSheetIngredients(knowledge: {
  key_ingredients?: unknown;
  key_ingredients_functions?: unknown;
  ingredient_highlights?: unknown;
  full_ingredients?: unknown;
}): DedupeIngredientsResult {
  const NO_INFO_MSG = "Chưa có thông tin trong tài liệu nguồn.";

  // 1. Resolve canonical key_ingredients
  let keyIngredients: string[] = [];
  if (
    Array.isArray(knowledge?.key_ingredients_functions) &&
    knowledge.key_ingredients_functions.length > 0
  ) {
    keyIngredients = knowledge.key_ingredients_functions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && item.name) {
          return item.function ? `${item.name}: ${item.function}` : item.name;
        }
        return "";
      })
      .filter(Boolean);
  } else if (Array.isArray(knowledge?.key_ingredients)) {
    keyIngredients = knowledge.key_ingredients
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .map((item) => item.trim());
  }

  const validKeyIngredients = keyIngredients.filter((item) => item !== NO_INFO_MSG);
  const hasKeyIngredients = validKeyIngredients.length > 0;

  // 2. Resolve ingredient_highlights (short tags only)
  let rawHighlights: string[] = [];
  if (Array.isArray(knowledge?.ingredient_highlights)) {
    rawHighlights = knowledge.ingredient_highlights
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .map((item) => {
        const colonIdx = item.indexOf(":");
        if (colonIdx !== -1) {
          return item
            .slice(0, colonIdx)
            .replace(/^[-*•\d.]+\s*/, "")
            .trim();
        }
        return item.replace(/^[-*•\d.]+\s*/, "").trim();
      })
      .filter((item) => item !== NO_INFO_MSG);
  }

  // 3. Dedupe overlapping ingredient names
  const keyNames = new Set(
    validKeyIngredients.map((item) => extractIngredientName(item)).filter(Boolean),
  );

  const dedupedHighlights = rawHighlights.filter(
    (item) => !keyNames.has(extractIngredientName(item)),
  );

  // 4. Resolve full_ingredients
  let fullIngredients = "";
  if (
    typeof knowledge?.full_ingredients === "string" &&
    knowledge.full_ingredients.trim() !== "" &&
    knowledge.full_ingredients.trim() !== NO_INFO_MSG
  ) {
    fullIngredients = knowledge.full_ingredients.trim();
  }

  return {
    key_ingredients: hasKeyIngredients ? validKeyIngredients : [],
    ingredient_highlights: dedupedHighlights,
    full_ingredients: fullIngredients,
    has_key_ingredients: hasKeyIngredients,
    // Only render highlights if key ingredients is absent and highlights has valid items
    show_ingredient_highlights: !hasKeyIngredients && dedupedHighlights.length > 0,
  };
}

/**
 * Cleans template HTML before rendering to:
 * 1. Guarantee customer-facing wording:
 *    - "TÀI LIỆU ĐÀO TẠO NỘI BỘ" -> "THÔNG TIN SẢN PHẨM"
 *    - "BẢNG GIÁ ĐỐI TÁC" -> "BẢNG GIÁ SẢN PHẨM"
 *    - "Tài liệu lưu hành nội bộ..." -> "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam."
 * 2. Remove "THÀNH PHẦN NỔI BẬT" when key_ingredients exists.
 * 3. In customer audience mode (default):
 *    - Remove "LƯU Ý TƯ VẤN" section entirely.
 *    - Convert advisory grid to 1 column.
 *    - Rename "CHỐNG CHỈ ĐỊNH" to "CẢNH BÁO / CHỐNG CHỈ ĐỊNH".
 */
export function cleanSalesSheetTemplateHtml(
  templateHtml: string,
  hasKeyIngredients: boolean,
  audience: "customer" | "internal" = "customer",
): string {
  if (!templateHtml) return "";
  let cleaned = templateHtml;

  // 1. Customer-safe top badge (Replace "TÀI LIỆU ĐÀO TẠO NỘI BỘ" with "THÔNG TIN SẢN PHẨM")
  cleaned = cleaned.replace(/TÀI LIỆU ĐÀO TẠO NỘI BỘ/gi, "THÔNG TIN SẢN PHẨM");
  cleaned = cleaned.replace(
    /color:\s*#b45309;\s*text-transform:\s*uppercase;\s*letter-spacing:\s*0\.15em;\s*background:\s*#fef3c7;\s*padding:\s*2px\s*6px;\s*border-radius:\s*4px;\s*border:\s*1px\s*solid\s*#fde68a;/gi,
    "color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.15em; background: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe;",
  );

  // 2. Customer-safe price section title (Replace "BẢNG GIÁ ĐỐI TÁC" with "BẢNG GIÁ SẢN PHẨM")
  cleaned = cleaned.replace(/BẢNG GIÁ ĐỐI TÁC/gi, "BẢNG GIÁ SẢN PHẨM");

  // 3. Customer-safe footer notes
  cleaned = cleaned.replace(
    /Tài liệu lưu hành nội bộ Desembre/gi,
    "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam",
  );
  cleaned = cleaned.replace(
    /Tài liệu lưu hành nội bộ\s*\|\s*Desembre VN/gi,
    "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam",
  );

  // 4. Ingredient deduplication
  if (hasKeyIngredients) {
    // Remove static comment + block
    cleaned = cleaned.replace(
      /<!--\s*Ingredient Highlights\s*-->\s*<div>\s*<h4[^>]*>\s*THÀNH PHẦN NỔI BẬT\s*<\/h4>\s*<div[^>]*>\{\{knowledge\.ingredient_highlights\}\}<\/div>\s*<\/div>/gi,
      "",
    );
    // Remove without comment
    cleaned = cleaned.replace(
      /<div>\s*<h4[^>]*>\s*THÀNH PHẦN NỔI BẬT\s*<\/h4>\s*<div[^>]*>\{\{knowledge\.ingredient_highlights\}\}<\/div>\s*<\/div>/gi,
      "",
    );
  }

  // 5. Audience-specific filters (Customer vs Internal)
  if (audience === "customer") {
    // Remove "LƯU Ý TƯ VẤN" container block
    cleaned = cleaned.replace(
      /<div[^>]*>\s*<h4[^>]*>\s*LƯU Ý TƯ VẤN\s*<\/h4>[\s\S]*?<\/div>\s*<\/div>/gi,
      "",
    );
    cleaned = cleaned.replace(/<div>\s*<h4[^>]*>\s*LƯU Ý TƯ VẤN\s*<\/h4>[\s\S]*?<\/div>/gi, "");

    // Adjust grid columns if advisory & warnings was a 2-column grid
    cleaned = cleaned.replace(
      /grid-template-columns:\s*1fr\s+1fr;/gi,
      "grid-template-columns: 1fr;",
    );

    // Rename "CHỐNG CHỈ ĐỊNH" to "CẢNH BÁO / CHỐNG CHỈ ĐỊNH"
    cleaned = cleaned.replace(/>\s*CHỐNG CHỈ ĐỊNH\s*</gi, ">CẢNH BÁO / CHỐNG CHỈ ĐỊNH<");
  }

  return cleaned;
}

/**
 * Generates a clean, safe, customer-facing filename for PDF export.
 * e.g. "Desembre Milk Essential Cleanser" -> "Desembre-Milk-Essential-Cleanser-sales-sheet.pdf"
 */
export function generateSalesSheetFileName(productName?: string): string {
  if (!productName || !productName.trim()) {
    return "Desembre-Product-sales-sheet.pdf";
  }

  const slug = productName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return `${slug || "Desembre-Product"}-sales-sheet.pdf`;
}

/**
 * HTML template for Product Sales Sheet Premium v1 (contains top-right DESEMBRE Luxury Cosmetics logo).
 * SOURCE OF TRUTH: must stay in sync with DEFAULT_HTML_TEMPLATE in ProductSalesSheetDialog.tsx.
 */
export const PRODUCT_SALES_SHEET_V1_HTML = `<div style="font-family: 'Inter', sans-serif; max-width: 100%; color: #1e293b; line-height: 1.4; padding: 5px;">
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

</div>`;

/**
 * HTML template for Product Sales Sheet Premium v2 (Customer-facing A4 without top-right logo).
 * Identical to V1 except the top-right DESEMBRE / Luxury Cosmetics logo block is removed.
 * SOURCE OF TRUTH: must stay in sync with DEFAULT_HTML_TEMPLATE_V2 in ProductSalesSheetDialog.tsx.
 */
export const PRODUCT_SALES_SHEET_V2_HTML = `<div style="font-family: 'Inter', sans-serif; max-width: 100%; color: #1e293b; line-height: 1.4; padding: 5px;">
  <!-- Premium Header (No right text logo) -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px;">
    <div>
      <span style="font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.15em; background: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe;">THÔNG TIN SẢN PHẨM</span>
      <h1 style="font-size: 20px; font-weight: 900; margin: 6px 0 2px 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">{{product.name}}</h1>
      <p style="font-size: 11px; color: #64748b; margin: 0;">Thương hiệu: <strong style="color: #1e3a8a;">{{product.brand_name}}</strong> | Danh mục: <strong>{{product.category_name}}</strong></p>
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

</div>`;



/**
 * Determines whether a given template (by name or HTML content) is v2 (no brand logo).
 */
export function isTemplateV2(templateName?: string, templateHtml?: string): boolean {
  if (templateName) {
    const lower = templateName.toLowerCase();
    if (lower.includes("v2") || lower === "product_sales_sheet_premium_v2") {
      return true;
    }
  }
  if (templateHtml) {
    if (!templateHtml.includes("LUXURY COSMETICS") && !templateHtml.includes("Luxury Cosmetics")) {
      return true;
    }
  }
  return false;
}

