import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";

export type DuplicateAction = "skip" | "overwrite";
export type SourceType = "csv" | "json" | "text";

export interface ImportRow {
  product_id: number;
  benefits: string;
  skin_concerns: string[];
  suitable_spa_types: string[];
  usage_instructions: string;
  sales_pitch: string;
  cross_sell_products: number[];
  restock_cycle_days: number;
  warnings: string;
  is_active: boolean;
  ingredient_highlights: string[];
  skin_types: string[];
  pregnancy_safe: boolean | null;
  routine_position: string;
}

export interface ValidationError {
  rowNumber: number;
  productId?: number;
  field?: string;
  message: string;
  rawRow: any;
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  errors: ValidationError[];
  warnings: string[];
  logId?: string;
}

// Helper to normalize string arrays (e.g. from "mụn, thâm" or ["mụn", "thâm"])
export function normalizeStringArray(val: any): string[] {
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) {
    return val.map((v) => String(v).trim()).filter(Boolean);
  }
  const strVal = String(val).trim();
  if (strVal.startsWith("[") && strVal.endsWith("]")) {
    try {
      const parsed = JSON.parse(strVal);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch (e) {
      // Ignore and fallback to normal string splitting
    }
  }
  return strVal
    .split(/[,\n;|]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

// Helper to normalize integer arrays (e.g. from "1, 2, 3" or [1, 2])
export function normalizeIntegerArray(val: any): number[] {
  const stringArray = normalizeStringArray(val);
  return stringArray.map((v) => parseInt(v, 10)).filter((v) => !isNaN(v));
}

// Helper to normalize pregnancy_safe and is_active to boolean/null
export function normalizeBoolean(val: any): boolean | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "boolean") return val;
  const str = String(val).trim().toLowerCase();
  if (["true", "1", "yes", "có", "co", "ok", "active"].includes(str)) return true;
  if (["false", "0", "no", "không", "khong", "inactive"].includes(str)) return false;
  return null;
}

// Parse Raw Text which can be JSON, CSV, or Key-Value pairs
export function parseRawText(text: string): any[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. Try JSON
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      // Fallback
    }
  }

  // 2. Try CSV/TSV
  const csvParsed = Papa.parse(trimmed, {
    header: true,
    skipEmptyLines: "greedy",
  });

  if (csvParsed.data && csvParsed.data.length > 0) {
    // If we only have 1 column and it looks like key-value pairs (contains colons), fall back to key-value
    const headers = csvParsed.meta.fields || [];
    if (headers.length > 1) {
      return csvParsed.data;
    }
  }

  // 3. Key-Value Parser for copy-pasted blocks (e.g. single product)
  const obj: Record<string, any> = {};
  const lines = trimmed.split("\n");
  let hasValidKeys = false;

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const val = line.substring(colonIndex + 1).trim();
      if (key && val) {
        // Map common Vietnamese & English key aliases
        const normalizedKey = getNormalizedKey(key);
        obj[normalizedKey] = val;
        hasValidKeys = true;
      }
    }
  }

  if (hasValidKeys) {
    return [obj];
  }

  // Fallback to CSV data if nothing else worked
  return csvParsed.data || [];
}

// Helper to normalize alternate column names to schema keys
export function getNormalizedKey(key: string): string {
  const lower = key
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  const mappings: Record<string, string> = {
    productid: "product_id",
    masanpham: "product_id",
    masp: "product_id",
    id: "product_id",

    benefits: "benefits",
    loiich: "benefits",

    skinconcerns: "skin_concerns",
    tinhtrangda: "skin_concerns",
    tinh_trang_da: "skin_concerns",

    suitablespatypes: "suitable_spa_types",
    loaispaphuhop: "suitable_spa_types",

    usageinstructions: "usage_instructions",
    huongdansudung: "usage_instructions",
    hdsd: "usage_instructions",
    usage: "usage_instructions",

    salespitch: "sales_pitch",
    loikhuyenbanhang: "sales_pitch",
    kichbanbanhang: "sales_pitch",
    pitch: "sales_pitch",

    crosssellproducts: "cross_sell_products",
    sanphambancheo: "cross_sell_products",
    bancheo: "cross_sell_products",

    restockcycledays: "restock_cycle_days",
    chukydathang: "restock_cycle_days",
    chuky: "restock_cycle_days",

    warnings: "warnings",
    luuy: "warnings",
    chongchidinh: "warnings",
    warningscontraindications: "warnings",

    isactive: "is_active",
    hoatdong: "is_active",
    trangthai: "is_active",

    ingredienthighlights: "ingredient_highlights",
    thanhphannoibat: "ingredient_highlights",
    ingredients: "ingredient_highlights",

    skintypes: "skin_types",
    loaida: "skin_types",
    suitableskintypes: "skin_types",

    pregnancysafe: "pregnancy_safe",
    antoanchomebau: "pregnancy_safe",
    mebau: "pregnancy_safe",

    routineposition: "routine_position",
    vitrichutrinh: "routine_position",
    routine: "routine_position",
  };

  return mappings[lower] || key;
}

// Perform validation on a row
export function validateRow(
  rawRow: any,
  rowNumber: number,
): { error?: ValidationError; parsedRow?: ImportRow } {
  // Normalize keys first
  const normalizedRow: Record<string, any> = {};
  for (const k of Object.keys(rawRow)) {
    normalizedRow[getNormalizedKey(k)] = rawRow[k];
  }

  // 1. Validate product_id
  const rawId = normalizedRow.product_id;
  if (rawId === undefined || rawId === null || String(rawId).trim() === "") {
    return {
      error: {
        rowNumber,
        field: "product_id",
        message: "Trường product_id (Mã sản phẩm) là bắt buộc.",
        rawRow,
      },
    };
  }
  const productId = parseInt(String(rawId).trim(), 10);
  if (isNaN(productId) || productId <= 0) {
    return {
      error: {
        rowNumber,
        field: "product_id",
        message: `ID sản phẩm "${rawId}" phải là số nguyên dương hợp lệ.`,
        rawRow,
      },
    };
  }

  // 2. Validate benefits
  const benefits = String(normalizedRow.benefits || "").trim();
  if (!benefits) {
    return {
      error: {
        rowNumber,
        productId,
        field: "benefits",
        message: "Trường benefits (lợi ích) là bắt buộc và không được rỗng.",
        rawRow,
      },
    };
  }

  // 3. Validate usage_instructions
  const usageInstructions = String(normalizedRow.usage_instructions || "").trim();
  if (!usageInstructions) {
    return {
      error: {
        rowNumber,
        productId,
        field: "usage_instructions",
        message: "Trường usage_instructions (hướng dẫn sử dụng) là bắt buộc và không được rỗng.",
        rawRow,
      },
    };
  }

  // 4. Validate sales_pitch
  const salesPitch = String(normalizedRow.sales_pitch || "").trim();
  if (!salesPitch) {
    return {
      error: {
        rowNumber,
        productId,
        field: "sales_pitch",
        message: "Trường sales_pitch (lời khuyên bán hàng) là bắt buộc và không được rỗng.",
        rawRow,
      },
    };
  }

  // Parse details
  const skinConcerns = normalizeStringArray(normalizedRow.skin_concerns);
  const suitableSpaTypes = normalizeStringArray(normalizedRow.suitable_spa_types);
  const crossSellProducts = normalizeIntegerArray(normalizedRow.cross_sell_products);
  const ingredientHighlights = normalizeStringArray(normalizedRow.ingredient_highlights);
  const skinTypes = normalizeStringArray(normalizedRow.skin_types);

  const rawCycle = normalizedRow.restock_cycle_days;
  const restockCycleDays =
    rawCycle !== undefined && rawCycle !== null && rawCycle !== ""
      ? parseInt(String(rawCycle).trim(), 10)
      : 60;

  const warnings = String(normalizedRow.warnings || "").trim();
  const rawActive = normalizedRow.is_active;
  const isActive =
    rawActive !== undefined && rawActive !== null && rawActive !== ""
      ? normalizeBoolean(rawActive) !== false
      : true;

  const pregnancySafe = normalizeBoolean(normalizedRow.pregnancy_safe);
  const routinePosition = String(normalizedRow.routine_position || "").trim();

  return {
    parsedRow: {
      product_id: productId,
      benefits,
      skin_concerns: skinConcerns,
      suitable_spa_types: suitableSpaTypes,
      usage_instructions: usageInstructions,
      sales_pitch: salesPitch,
      cross_sell_products: crossSellProducts,
      restock_cycle_days: isNaN(restockCycleDays) ? 60 : restockCycleDays,
      warnings,
      is_active: isActive,
      ingredient_highlights: ingredientHighlights,
      skin_types: skinTypes,
      pregnancy_safe: pregnancySafe,
      routine_position: routinePosition,
    },
  };
}

// Main execution function
export async function executeImport(
  rawRows: any[],
  duplicateAction: DuplicateAction,
  sourceType: SourceType,
  fileName?: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    totalRows: rawRows.length,
    successCount: 0,
    errorCount: 0,
    warningCount: 0,
    errors: [],
    warnings: [],
  };

  if (rawRows.length === 0) {
    return result;
  }

  // Fetch current user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error("Chưa đăng nhập hoặc phiên đăng nhập hết hạn.");
  }
  const userId = userData.user.id;

  // Fetch all existing product_ids
  const { data: existingProducts, error: existingError } = await supabase
    .from("product_knowledge")
    .select("id, product_id");

  if (existingError) {
    throw new Error(`Không thể đọc danh sách sản phẩm hiện tại: ${existingError.message}`);
  }

  const existingMap = new Map<number, string>(); // product_id -> uuid
  if (existingProducts) {
    for (const p of existingProducts) {
      existingMap.set(p.product_id, p.id);
    }
  }

  const batchUpdates: ImportRow[] = [];
  const batchInserts: ImportRow[] = [];

  // Parse and validate rows
  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 1;
    const { error, parsedRow } = validateRow(rawRows[i], rowNumber);

    if (error) {
      result.errorCount++;
      result.errors.push(error);
      continue;
    }

    if (!parsedRow) continue;

    const productId = parsedRow.product_id;

    if (existingMap.has(productId)) {
      if (duplicateAction === "skip") {
        result.warningCount++;
        result.warnings.push(
          `Dòng ${rowNumber}: Sản phẩm ID ${productId} đã tồn tại trong hệ thống. Đã bỏ qua.`,
        );
        continue;
      } else {
        // Overwrite
        batchUpdates.push(parsedRow);
      }
    } else {
      // Insert
      batchInserts.push(parsedRow);
    }
  }

  // Execute inserts
  for (const item of batchInserts) {
    const { error } = await supabase.from("product_knowledge").insert({
      product_id: item.product_id,
      benefits: item.benefits,
      skin_concerns: item.skin_concerns,
      suitable_spa_types: item.suitable_spa_types,
      usage_instructions: item.usage_instructions,
      sales_pitch: item.sales_pitch,
      cross_sell_products: item.cross_sell_products,
      restock_cycle_days: item.restock_cycle_days,
      warnings: item.warnings,
      is_active: item.is_active,
      ingredient_highlights: item.ingredient_highlights,
      skin_types: item.skin_types,
      pregnancy_safe: item.pregnancy_safe,
      routine_position: item.routine_position,
      qa_status: "draft", // Always draft
      approved_by: null, // Always reset
      approved_at: null, // Always reset
      created_by: userId,
      updated_by: userId,
    });

    if (error) {
      result.errorCount++;
      result.errors.push({
        rowNumber: -1,
        productId: item.product_id,
        message: `Lỗi insert database: ${error.message}`,
        rawRow: item,
      });
    } else {
      result.successCount++;
    }
  }

  // Execute updates (overwrite)
  for (const item of batchUpdates) {
    const existingUuid = existingMap.get(item.product_id);
    if (!existingUuid) continue;

    const { error } = await supabase
      .from("product_knowledge")
      .update({
        benefits: item.benefits,
        skin_concerns: item.skin_concerns,
        suitable_spa_types: item.suitable_spa_types,
        usage_instructions: item.usage_instructions,
        sales_pitch: item.sales_pitch,
        cross_sell_products: item.cross_sell_products,
        restock_cycle_days: item.restock_cycle_days,
        warnings: item.warnings,
        is_active: item.is_active,
        ingredient_highlights: item.ingredient_highlights,
        skin_types: item.skin_types,
        pregnancy_safe: item.pregnancy_safe,
        routine_position: item.routine_position,
        qa_status: "draft", // Reset to draft
        approved_by: null, // Reset approved user
        approved_at: null, // Reset approved timestamp
        reviewed_by: null, // Reset reviewer user
        reviewed_at: null, // Reset reviewer timestamp
        rejection_reason: null, // Reset rejection reason
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingUuid);

    if (error) {
      result.errorCount++;
      result.errors.push({
        rowNumber: -1,
        productId: item.product_id,
        message: `Lỗi update database: ${error.message}`,
        rawRow: item,
      });
    } else {
      result.successCount++;
    }
  }

  // Write to audit log
  const warningsPreview = result.warnings.slice(0, 10);
  const { data: logData, error: logError } = await supabase
    .from("product_knowledge_import_logs")
    .insert({
      uploaded_by: userId,
      source_type: sourceType,
      total_rows: result.totalRows,
      success_count: result.successCount,
      error_count: result.errorCount,
      warning_count: result.warningCount,
      metadata: {
        fileName: fileName || "raw_text_input",
        duplicateAction,
        sourceType,
        importedAt: new Date().toISOString(),
        totalRows: result.totalRows,
        warningsPreview,
      },
    })
    .select("id")
    .single();

  if (logError) {
    console.error("Không thể ghi log import:", logError.message);
  } else if (logData) {
    result.logId = logData.id;
  }

  return result;
}
